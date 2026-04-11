"""
One-time setup: authorize Google Sheets access and store credentials in Modal.

Run this once:
  python3 execution/setup_google_oauth.py

A browser window will open. Log in with hutchinson.tris@gmail.com and
click Allow. The refresh token will be automatically saved to Modal secrets.

After this you never need to run it again — the Modal cron will use the
stored token to refresh itself automatically.
"""

import json
import os
import subprocess
import sys

# Load credentials from environment variables.
# Set these in your shell or a .env file before running:
#   GOOGLE_DESKTOP_CLIENT_ID     — OAuth client ID for the local auth flow
#   GOOGLE_DESKTOP_CLIENT_SECRET — OAuth client secret for the local auth flow
#   GOOGLE_SERVER_CLIENT_ID      — OAuth client ID stored in Modal (may differ)
#   GOOGLE_SERVER_CLIENT_SECRET  — OAuth client secret stored in Modal (may differ)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    from google_auth_oauthlib.flow import InstalledAppFlow
except ImportError:
    print("Installing google-auth-oauthlib...")
    subprocess.run([sys.executable, "-m", "pip", "install", "google-auth-oauthlib", "-q"], check=True)
    from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

CLIENT_CONFIG = {
    "installed": {
        "client_id": os.environ["GOOGLE_DESKTOP_CLIENT_ID"],
        "client_secret": os.environ["GOOGLE_DESKTOP_CLIENT_SECRET"],
        "redirect_uris": ["http://localhost"],
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
    }
}

print("Opening browser for Google authorization...")
print("Log in with hutchinson.tris@gmail.com and click Allow.\n")

flow = InstalledAppFlow.from_client_config(CLIENT_CONFIG, SCOPES)
creds = flow.run_local_server(port=0, prompt="consent", access_type="offline")

if not creds.refresh_token:
    print("\n❌ No refresh token received.")
    print("Try revoking app access at https://myaccount.google.com/permissions and re-running.")
    sys.exit(1)

print("\n✅ Authorization successful!")

token_data = json.dumps({
    "client_id": os.environ["GOOGLE_SERVER_CLIENT_ID"],
    "client_secret": os.environ["GOOGLE_SERVER_CLIENT_SECRET"],
    "refresh_token": creds.refresh_token,
    "token_uri": "https://oauth2.googleapis.com/token",
})

print("Storing credentials in Modal secret 'google-sheets-oauth'...")
result = subprocess.run(
    [sys.executable, "-m", "modal", "secret", "create",
     "google-sheets-oauth", f"GOOGLE_OAUTH_TOKEN={token_data}", "--force"],
    capture_output=True, text=True
)

if result.returncode != 0:
    print(f"\n❌ Failed to create Modal secret:\n{result.stderr}")
    print("\nRun this manually instead:")
    print(f'  python3 -m modal secret create google-sheets-oauth "GOOGLE_OAUTH_TOKEN={token_data}" --force')
    sys.exit(1)

print("✅ Credentials stored in Modal.")
print("\nNext step: deploy the Modal backend:")
print("  modal deploy execution/modal_sheets_sync.py")
