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

SPREADSHEET_ID = "1DzqXosxLZAmJfE1ksg8sAWi-Dtt0ZjMbZX5OAe4uoMM"
SHEET_NAME = "Form Responses 1"
SHEET_RANGE = f"'{SHEET_NAME}'!A:AD"

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

# Form Responses 1 (0-indexed) → dashboard schema field
# Other dashboard fields not collected by the form default to 0 / "".
CLOSER_COL_MAP = {
    "rep_name": 1,                   # B  Name
    "date": 3,                       # D  Date Of Given Stats
    "calls_booked_on_calendar": 20,  # U
    "calls_shown_up": 21,            # V
    "offers_made": 22,               # W
    "dqs": 23,                       # X  DQ's (financial, bad fit, etc)
    "deposits": 24,                  # Y
    "closes": 25,                    # Z
    "new_cash_collected": 26,        # AA New Cash Collected
    "total_revenue_generated": 27,   # AB Total Revenue Generated
}

ROLE_COL = 2  # C  "Are you a Setter or a closer"

# Inbound Closing dashboard — accept only these roles. Excludes "Outbound Closer".
INBOUND_CLOSER_ROLES = {"inbound closer", "closer"}


def is_inbound_closer(role: str) -> bool:
    return bool(role) and role.strip().lower() in INBOUND_CLOSER_ROLES


def is_test_row(rep: str) -> bool:
    return rep.strip().lower() in {"test", "test user", "testing"}


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


def parse_date(val) -> str:
    """Normalize a sheet date cell to ISO YYYY-MM-DD. Returns "" if unparseable."""
    from datetime import date, timedelta

    if val is None:
        return ""
    s = str(val).strip()
    if not s:
        return ""

    # Google Sheets serial number (days since 1899-12-30)
    try:
        n = float(s)
        if 1 <= n <= 80000:
            return (date(1899, 12, 30) + timedelta(days=int(n))).isoformat()
    except ValueError:
        pass

    # Common string formats
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%-m/%-d/%Y", "%d/%m/%Y"):
        try:
            from datetime import datetime
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue

    return ""


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
    """Reads the form-response tab and returns parsed closer rows in the dashboard schema."""
    service = get_sheets_service()
    result = (
        service.spreadsheets()
        .values()
        .get(spreadsheetId=SPREADSHEET_ID, range=SHEET_RANGE)
        .execute()
    )
    rows = result.get("values", [])
    if not rows or len(rows) < 2:
        print("No data found in sheet")
        return []

    records = []
    skipped_role = 0
    skipped_norep = 0
    skipped_test = 0
    for row in rows[1:]:  # skip header
        padded = (row + [""] * 28)[:28]
        role = padded[ROLE_COL].strip() if padded[ROLE_COL] else ""
        if not is_inbound_closer(role):
            skipped_role += 1
            continue
        rep = padded[CLOSER_COL_MAP["rep_name"]].strip()
        if not rep:
            skipped_norep += 1
            continue
        if is_test_row(rep):
            skipped_test += 1
            continue

        record: dict = {}
        for col in COLUMNS:
            src_idx = CLOSER_COL_MAP.get(col)
            val = padded[src_idx] if src_idx is not None else ""
            if col == "rep_name":
                record[col] = rep
            elif col == "date":
                record[col] = parse_date(val)
            elif col in MONEY_FIELDS:
                record[col] = parse_money(val)
            elif col in INT_FIELDS:
                record[col] = parse_int(val)
            else:
                record[col] = str(val).strip()
        records.append(record)

    print(
        f"Parsed {len(records)} inbound-closer records; "
        f"skipped {skipped_role} non-inbound, {skipped_norep} blank-rep, "
        f"{skipped_test} test rows"
    )
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
