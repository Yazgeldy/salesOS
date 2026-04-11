"""
Modal backend for SOS Mastermind — Inbound Closing dashboard.

Architecture:
  - daily_sync(): scheduled cron (6 AM UTC daily) — reads Google Sheet, stores in Modal Dict
  - serve_data(): web endpoint — returns cached data as JSON, fetches live on cold start

Setup:
  1. Create Google Cloud service account with Sheets API access
  2. Share sheet with service account email
  3. modal secret create google-sheets-creds GOOGLE_SERVICE_ACCOUNT_JSON='$(cat /path/to/key.json)'
  4. modal deploy execution/modal_sheets_sync.py

To force a refresh:
  modal run execution/modal_sheets_sync.py::daily_sync
"""

import modal
import os
from datetime import datetime

app = modal.App("sales-dashboard")

image = modal.Image.debian_slim().pip_install(
    ["google-auth", "google-api-python-client", "google-auth-httplib2"]
)

data_store = modal.Dict.from_name("sales-dashboard-data", create_if_missing=True)

SPREADSHEET_ID = "1BWzEYMPZVCNTU_u_aL8xJF09uBN2Z2hiS77FVWucKNo"
SHEET_RANGE = "Inbound Closing"

# Column order (0-indexed) as they appear in the sheet
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

# Words that indicate a row is NOT a rep name (e.g., objection text bleed-over)
REJECT_WORDS = {
    "total", "average", "avg", "objection", "how", "what", "why", "when",
    "note", "summary", "follow", "calls", "booked", "cancelled", "closed",
    "date", "rep", "name", "cash", "revenue", "rate", "close", "show",
    "outbound", "offer", "deposit", "upsell", "rescheduled", "dq",
}


def is_valid_rep_name(val: str) -> bool:
    """
    Determines if a cell value is a valid closer name.
    Rejects: empty, numeric, dollar amounts, objection text bleed-over,
             rows that start with lowercase, rows with digits.
    """
    if not val or not val.strip():
        return False
    val = val.strip()

    # Reject dollar amounts
    if val.startswith("$"):
        return False

    # Reject pure numbers
    try:
        float(val.replace(",", "").replace("$", ""))
        return False
    except ValueError:
        pass

    # Reject if contains any digit (rep names don't have numbers)
    if any(c.isdigit() for c in val):
        return False

    # Must start with uppercase (proper name)
    if not val[0].isupper():
        return False

    # Too long to be a personal name (catches sentence bleed-over)
    words = val.split()
    if len(words) > 4:
        return False

    # Reject if first word matches known non-name patterns
    if words[0].lower() in REJECT_WORDS:
        return False

    return True


def parse_money(val) -> float:
    """Parse a dollar value like '$1,234.56' or '1234' to float."""
    if not val:
        return 0.0
    try:
        cleaned = str(val).replace("$", "").replace(",", "").strip()
        return float(cleaned) if cleaned else 0.0
    except (ValueError, TypeError):
        return 0.0


def parse_int(val) -> int:
    """Parse an integer value, handling commas and floats."""
    if not val:
        return 0
    try:
        cleaned = str(val).replace(",", "").strip()
        return int(float(cleaned)) if cleaned else 0
    except (ValueError, TypeError):
        return 0


def fetch_sheet_data() -> list[dict]:
    """
    Reads the Inbound Closing tab from Google Sheets.
    Returns a list of dicts with parsed and cleaned row data.
    Filters out any rows where col[0] is not a valid rep name.
    """
    import json
    from google.oauth2.service_account import Credentials
    from googleapiclient.discovery import build

    creds_json = os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"]
    creds = Credentials.from_service_account_info(
        json.loads(creds_json),
        scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"],
    )
    service = build("sheets", "v4", credentials=creds)

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
    skipped = 0

    for row in rows[1:]:  # Skip header row
        # Pad to 19 columns so index access is always safe
        padded = (row + [""] * 19)[:19]

        rep = padded[0].strip() if padded[0] else ""
        if not is_valid_rep_name(rep):
            skipped += 1
            continue

        record = {}
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
    secrets=[modal.Secret.from_name("google-sheets-creds")],
    schedule=modal.Cron("0 6 * * *"),
)
def daily_sync():
    """
    Scheduled cron: runs daily at 6 AM UTC.
    Reads the Google Sheet and stores parsed data in the Modal Dict.
    """
    records = fetch_sheet_data()
    data_store["inbound_closing"] = records
    data_store["last_sync"] = datetime.utcnow().isoformat()
    print(f"Daily sync complete: {len(records)} records stored")


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("google-sheets-creds")],
)
@modal.web_endpoint(method="GET")
def serve_data():
    """
    Web endpoint: returns the cached data as JSON.
    On first call (cold start / no cache), fetches live from Google Sheets.
    """
    from fastapi.responses import JSONResponse

    CORS_HEADERS = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }

    records = data_store.get("inbound_closing")
    last_sync = data_store.get("last_sync", "")

    if records is None:
        # First run or cache cleared — fetch live
        print("Cache miss: fetching live data from Google Sheets")
        records = fetch_sheet_data()
        data_store["inbound_closing"] = records
        last_sync = datetime.utcnow().isoformat()
        data_store["last_sync"] = last_sync

    return JSONResponse(
        content={
            "data": records,
            "last_sync": last_sync,
            "count": len(records),
        },
        headers=CORS_HEADERS,
    )
