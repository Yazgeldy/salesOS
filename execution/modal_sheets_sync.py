"""
Modal backend for SOS Mastermind — Inbound Closing dashboard.

Auth: OAuth 2.0 user credentials (refresh token stored in Modal secret).
Run execution/setup_google_oauth.py once to authorize and store the token.

Functions:
  daily_sync()  — scheduled cron (6 AM UTC), reads sheet, caches in Modal Dict
  serve_data()  — web endpoint, returns cached JSON (fetches live on cold start)

Deploy:
  python3 execution/setup_google_oauth.py   # one-time auth
  modal deploy execution/modal_sheets_sync.py
"""

import modal
import json
import os
from datetime import datetime, timezone

app = modal.App("sales-dashboard")

image = modal.Image.debian_slim(python_version="3.12").pip_install(
    ["google-auth", "google-api-python-client", "google-auth-httplib2", "fastapi"]
)

data_store = modal.Dict.from_name("sales-dashboard-data", create_if_missing=True)

SPREADSHEET_ID = "1BWzEYMPZVCNTU_u_aL8xJF09uBN2Z2hiS77FVWucKNo"
SHEET_NAME = "Inbound Closing"

COLUMNS = [
    "rep_name", "date", "outbound_calls_made", "outbound_calls_booked",
    "calls_booked_on_calendar", "calls_rescheduled", "calls_cancelled",
    "calls_shown_up", "offers_made", "dqs", "deposits", "closes",
    "upsells", "new_cash_collected", "recurring_cash_collected",
    "upsell_cash_collected", "followup_cash_collected",
    "total_revenue_generated", "objections",
]

MONEY_FIELDS = {
    "new_cash_collected", "recurring_cash_collected",
    "upsell_cash_collected", "followup_cash_collected",
    "total_revenue_generated",
}

INT_FIELDS = {
    "outbound_calls_made", "outbound_calls_booked", "calls_booked_on_calendar",
    "calls_rescheduled", "calls_cancelled", "calls_shown_up", "offers_made",
    "dqs", "deposits", "closes", "upsells",
}

REJECT_WORDS = {
    "total", "average", "avg", "objection", "how", "what", "why", "when",
    "note", "summary", "follow", "calls", "booked", "cancelled", "closed",
    "date", "rep", "name", "cash", "revenue", "rate", "close", "show",
    "outbound", "offer", "deposit", "upsell", "rescheduled", "dq",
}


def is_valid_rep_name(val: str) -> bool:
    if not val or not val.strip():
        return False
    val = val.strip()
    if val.startswith("$"):
        return False
    try:
        float(val.replace(",", "").replace("$", ""))
        return False
    except ValueError:
        pass
    if any(c.isdigit() for c in val):
        return False
    if not val[0].isupper():
        return False
    if len(val.split()) > 4:
        return False
    if val.split()[0].lower() in REJECT_WORDS:
        return False
    return True


def parse_money(val) -> float:
    if not val:
        return 0.0
    try:
        return float(str(val).replace("$", "").replace(",", "").strip() or 0)
    except (ValueError, TypeError):
        return 0.0


def parse_int(val) -> int:
    if not val:
        return 0
    try:
        return int(float(str(val).replace(",", "").strip() or 0))
    except (ValueError, TypeError):
        return 0


def get_sheets_service():
    """Builds a Google Sheets API service using the stored OAuth refresh token."""
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    token_data = json.loads(os.environ["GOOGLE_OAUTH_TOKEN"])
    creds = Credentials(
        token=None,
        refresh_token=token_data["refresh_token"],
        client_id=token_data["client_id"],
        client_secret=token_data["client_secret"],
        token_uri=token_data["token_uri"],
        scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"],
    )
    return build("sheets", "v4", credentials=creds)


def fetch_sheet_data() -> list:
    """Reads the Inbound Closing tab and returns a list of parsed row dicts."""
    service = get_sheets_service()
    result = (
        service.spreadsheets()
        .values()
        .get(spreadsheetId=SPREADSHEET_ID, range=SHEET_NAME)
        .execute()
    )
    rows = result.get("values", [])
    if not rows or len(rows) < 2:
        print("No data found in sheet")
        return []

    records = []
    skipped = 0
    for row in rows[1:]:  # skip header
        padded = (row + [""] * 19)[:19]
        rep = padded[0].strip() if padded[0] else ""
        if not is_valid_rep_name(rep):
            skipped += 1
            continue
        record: dict = {}
        for i, col in enumerate(COLUMNS):
            val = padded[i] if i < len(padded) else ""
            if col == "rep_name":
                record[col] = rep
            elif col in MONEY_FIELDS:
                record[col] = parse_money(val)
            elif col in INT_FIELDS:
                record[col] = parse_int(val)
            else:
                record[col] = str(val).strip()
        records.append(record)

    print(f"Parsed {len(records)} records, skipped {skipped} non-rep rows")
    return records


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("google-sheets-oauth")],
    schedule=modal.Cron("0 6 * * *"),
)
def daily_sync():
    """Runs daily at 6 AM UTC — refreshes cached data from Google Sheets."""
    records = fetch_sheet_data()
    data_store["inbound_closing"] = records
    data_store["last_sync"] = datetime.now(timezone.utc).isoformat()
    print(f"Sync complete: {len(records)} records")


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("google-sheets-oauth")],
)
@modal.fastapi_endpoint(method="GET")
def serve_data():
    """Returns cached sales data as JSON. Fetches live on first call."""
    records = data_store.get("inbound_closing")
    last_sync = data_store.get("last_sync", "")

    if records is None:
        print("Cache empty — fetching live data")
        records = fetch_sheet_data()
        data_store["inbound_closing"] = records
        last_sync = datetime.now(timezone.utc).isoformat()
        data_store["last_sync"] = last_sync

    return {"data": records, "last_sync": last_sync, "count": len(records)}
