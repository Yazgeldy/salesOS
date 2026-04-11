# Directive: SOS Mastermind — Inbound Closing Dashboard

## System Architecture

```
Google Sheet (read-only)
    ↓  Google Sheets API v4 (service account)
Modal Cron (daily @ 6 AM UTC)  →  Modal Dict (cache)
    ↓  HTTPS JSON endpoint
Next.js API Route (/api/sales)  →  Vercel Edge
    ↓  Client fetch
React Dashboard (Vercel)
```

**Layer responsibilities:**
- **Directive** (this file): defines objectives, column schema, business rules
- **Orchestration** (Claude): routing, error handling, directive updates
- **Execution** (`execution/modal_sheets_sync.py`): deterministic data fetch + serve

---

## Data Source

- **Sheet ID:** `1BWzEYMPZVCNTU_u_aL8xJF09uBN2Z2hiS77FVWucKNo`
- **Tab:** `Inbound Closing`
- **Access:** Read-only via service account

### Column Manifest (0-indexed)

| Index | Field | Type | Notes |
|-------|-------|------|-------|
| 0 | rep_name | string | Validated: short proper name, uppercase first char, no digits |
| 1 | date | string | M/D/YYYY or YYYY-MM-DD format |
| 2 | outbound_calls_made | int | |
| 3 | outbound_calls_booked | int | |
| 4 | calls_booked_on_calendar | int | |
| 5 | calls_rescheduled | int | |
| 6 | calls_cancelled | int | |
| 7 | calls_shown_up | int | |
| 8 | offers_made | int | |
| 9 | dqs | int | Financial DQs, bad fit, etc. |
| 10 | deposits | int | |
| 11 | closes | int | |
| 12 | upsells | int | |
| 13 | new_cash_collected | float | Dollar value; strip $, commas |
| 14 | recurring_cash_collected | float | Portion of new_cash; strip $, commas |
| 15 | upsell_cash_collected | float | Portion of new_cash; strip $, commas |
| 16 | followup_cash_collected | float | Portion of new_cash; strip $, commas |
| 17 | total_revenue_generated | float | Contract value, NOT cash collected |
| 18 | objections | string | Free text; may bleed into next row |

---

## Valid Rep Name Detection

The `objections` column (index 18) contains free text that can spill into the next row's rep_name column. The `is_valid_rep_name()` function guards against this with these rules:

1. **Empty**: Reject empty strings
2. **Dollar amount**: Reject strings starting with `$`
3. **Numeric**: Reject strings that parse as float (after removing `$` and `,`)
4. **Contains digits**: Reject if any character is a digit (rep names don't have numbers)
5. **Starts lowercase**: Must start with uppercase (proper name convention)
6. **Too long**: Reject strings with more than 4 words (sentences = objection text)
7. **Reject-word list**: First word matches known non-name patterns: total, average, objection, how, what, why, when, note, summary, follow, calls, booked, cancelled, closed, date, rep, name, cash, revenue, rate, close, show, outbound, offer, deposit, upsell, rescheduled, dq

**If a new rep name is being rejected:** Examine the `REJECT_WORDS` set in `modal_sheets_sync.py` and check if their name or part of it collides. Remove or adjust the reject word.

---

## Business Formula Definitions

All rates are computed from **summed raw fields** — never by averaging rates across reps.

| KPI | Formula | Division Guard |
|-----|---------|---------------|
| Show Rate | `calls_shown_up / calls_booked_on_calendar` | `calls_booked_on_calendar > 0` |
| Close Rate | `closes / calls_shown_up` | `calls_shown_up > 0` |
| Offer Rate | `offers_made / calls_shown_up` | `calls_shown_up > 0` |
| Avg Deal Size | `total_revenue_generated / closes` | `closes > 0` |
| Contract Value/Day | `total_revenue_generated / days_tracked` | `days_tracked > 0` |
| Cash/Day | `new_cash_collected / days_tracked` | `days_tracked > 0` |
| Days Tracked | Count of distinct `date` strings for that rep | Min 1 |

**Cash relationships:**
- `new_cash_collected` = total cash collected on that day (the whole pie)
- `recurring_cash_collected`, `upsell_cash_collected`, `followup_cash_collected` = portions of `new_cash_collected`
- `total_revenue_generated` = contract value agreed to (may differ significantly from cash collected)

---

## Operational Runbook

### Deploy Modal Backend
```bash
# First time: set up credentials
modal secret create google-sheets-creds \
  GOOGLE_SERVICE_ACCOUNT_JSON="$(cat /path/to/service-account-key.json)"

# Deploy (prints the web endpoint URL)
cd execution
modal deploy modal_sheets_sync.py
```
Copy the printed `serve_data` URL — it looks like:
`https://your-org--sales-dashboard-serve-data.modal.run`

### Configure Frontend
```bash
echo "MODAL_API_URL=https://your-org--sales-dashboard-serve-data.modal.run" > frontend/.env.local
```

### Run Locally
```bash
cd frontend
npm install    # first time only
npm run dev
# Visit http://localhost:3000
```

### Force a Data Refresh (Bypass Daily Cache)
```bash
modal run execution/modal_sheets_sync.py::daily_sync
```

### Verify the JSON endpoint directly
```bash
curl https://your-org--sales-dashboard-serve-data.modal.run | python3 -m json.tool | head -50
```

### Deploy to Vercel
1. `vercel.com/new` → Import `https://github.com/Yazgeldy/salesOS`
2. Root Directory: `frontend`
3. Add environment variable: `MODAL_API_URL` = `<modal endpoint url>`
4. Deploy — auto-deploys on every push to main

### Add a New Rep
No code changes needed. New reps are auto-detected from the sheet on the next sync.
If their name is being incorrectly filtered, check `REJECT_WORDS` in `modal_sheets_sync.py`.

### Clear the Modal Dict cache (force cold-start re-fetch)
```python
# Run once interactively with: modal run -q
import modal
store = modal.Dict.from_name("sales-dashboard-data")
del store["inbound_closing"]
```
The next web endpoint call will fetch fresh data live.

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| `MODAL_API_URL` not set | API route returns `{data: [], _warning: "..."}` — dashboard shows empty state with message |
| Modal endpoint unreachable | API route returns `{data: [], _error: "..."}` — dashboard shows error card |
| `data_store["inbound_closing"]` missing (first deploy) | `serve_data()` fetches live from Google Sheets on first request |
| Row with unparseable date | Included in results but excluded from date range filtering |
| Division by zero in rate calculation | All rate computations guarded — returns `0` |
| Objection text in rep_name column | Filtered by `is_valid_rep_name()` |

---

## Frontend Component Tree

```
page.tsx (state owner, 'use client')
├── header: title + record count + view toggle
├── FilterBar.tsx — rep multi-select + date range
├── KPICards.tsx — two rows of 5 KPI cards
└── [activeView]
    ├── HeatmapView.tsx — 23 KPI rows × N rep columns
    ├── ChartsView.tsx — 6 Recharts charts (2-col grid)
    └── LeaderboardView.tsx — ranked table with medals
```

---

## Future Improvements (not implemented)

- Manual refresh button in the header (calls `/api/sales?force=true` which bypasses cache)
- Export to CSV button on the leaderboard
- Rep-level drill-down page (click a rep name to see their daily trend)
- Slack/email alerts when close rate drops below threshold
