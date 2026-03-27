# Copper Builders Sales Log — Developer Guide

**Last Updated:** March 27, 2026

This guide is for anyone pulling up this codebase for the first time — everything you need to understand, run, and modify the app.

---

## Overview

A standalone web app where sales reps submit weekly activity (leads, appointments, prospects, sales). Data is stored in Google Sheets. Every Monday at 10:30 AM ET, the system automatically consolidates all submissions into a weekly results report.

**Live App:** https://copper-builders-log.vercel.app/
**Help Page:** https://copper-builders-log.vercel.app/how-it-works.html
**GitHub:** https://github.com/wade-cyber/copper-builders-sales-log

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 8 |
| Backend | Vercel Serverless Functions (7 routes) |
| Data | Google Sheets API v4 |
| Auth | google-auth-library (service account) |
| Styling | Vanilla CSS (no framework) |
| Deployment | Vercel (auto-deploys on git push) |

---

## Getting Started

### 1. Clone and install
```bash
git clone https://github.com/wade-cyber/copper-builders-sales-log.git
cd copper-builders-sales-log
npm install
```

### 2. Set up environment
Copy `.env.example` to `.env` and fill in the values:
```bash
cp .env.example .env
```

Required variables:
```
GOOGLE_SERVICE_ACCOUNT_EMAIL=copper-builders-sheets@axial-diagram-489522-n6.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
SALES_APP_SHEET_ID=1WRPxRr6xU2h0lOw20s1NkMk5gk1pgYh_2LNAUcvUxU4
ASSIGNMENTS_SHEET_ID=1vCDaPFo-R_2Wpv2lfGtjA8Q6XeJx1_D0abAC0y3eq3Y
TEMPLATE_SHEET_ID=1K5sEUqfu3Z7bYUUCEJSfZPfbaPGCpg4iFYx8YQLT-BU
```

The service account must have **Editor** access to the Sales App Reporting and Sales Rep Assignments sheets, and **Viewer** access to the OSC Leads Report sheet.

### 3. Run locally
```bash
npm run dev     # Starts Vite dev server at http://localhost:5173
```

### 4. Build and deploy
```bash
npm run build   # Vite build → dist/
git push        # Auto-deploys to Vercel
```

---

## Project Structure

```
copper-builders-sales-log/
├── api/                              # Vercel serverless functions
│   ├── _lib/
│   │   ├── sheets.js                 # Google Sheets API wrapper (auth + CRUD)
│   │   └── sync-from-assignments-sheet.js  # Read/filter assignments
│   ├── get-reps.js                   # GET — list rep names
│   ├── get-assignments.js            # GET — rep's assigned projects
│   ├── get-prospects.js              # GET — rep's prospect pipeline
│   ├── get-last-sync.js              # GET — last sync timestamp
│   ├── save-prospect.js              # POST — create/update prospect
│   ├── submit-weekly-log.js          # POST — submit weekly report
│   └── monday-night.js               # POST/Cron — weekly consolidation
│
├── src/
│   ├── App.jsx                       # Main app (state, submission flow)
│   ├── main.jsx                      # React entry point
│   ├── index.css                     # All styles (responsive)
│   ├── components/
│   │   ├── Header.jsx                # App header with deadline
│   │   ├── RepSelector.jsx           # Name dropdown
│   │   ├── CommunityBlock.jsx        # Per-project data entry
│   │   ├── ProspectCard.jsx          # Individual prospect row
│   │   ├── AddProspectForm.jsx       # New prospect form
│   │   ├── SubmitScreen.jsx          # Success confirmation
│   │   └── ErrorBoundary.jsx         # Error wrapper
│   ├── hooks/
│   │   ├── useAssignments.js         # Fetch rep's projects
│   │   └── useProspects.js           # Fetch rep's prospects
│   └── utils/
│       ├── api.js                    # API calls with retry logic
│       ├── dates.js                  # Week ending calculations
│       └── constants.js              # Shared constants
│
├── public/
│   └── how-it-works.html             # User help page (with Loom video)
│
├── vercel.json                       # Cron schedule + security headers
├── package.json                      # Dependencies + scripts
├── .env.example                      # Required env vars
└── COPPER_BUILDERS_REPORTING_BRIEF.md  # User/manager documentation
```

---

## Google Sheets

### Sheets Used

| Env Var | Sheet | Purpose |
|---------|-------|---------|
| `SALES_APP_SHEET_ID` | [Sales App Reporting](https://docs.google.com/spreadsheets/d/1WRPxRr6xU2h0lOw20s1NkMk5gk1pgYh_2LNAUcvUxU4) | All app data (submissions, prospects, results) |
| `ASSIGNMENTS_SHEET_ID` | [Sales Rep Assignments](https://docs.google.com/spreadsheets/d/1vCDaPFo-R_2Wpv2lfGtjA8Q6XeJx1_D0abAC0y3eq3Y) | Rep→project assignments (managed by sales manager) |
| `TEMPLATE_SHEET_ID` | [OSC Leads Report](https://docs.google.com/spreadsheets/d/1K5sEUqfu3Z7bYUUCEJSfZPfbaPGCpg4iFYx8YQLT-BU) | Weekly lead data entered by the OSC |

### Tabs in Sales App Reporting

| Tab | What It Stores |
|-----|---------------|
| Submissions | Raw weekly entries (one row per rep per project per week) |
| Prospects | Full prospect pipeline (name, ranking, lot #, status) |
| Weekly Assignments | Cached copy of assignments for fast app loading |
| Last Weeks Results | Current week's consolidated results (stable name for external tools) |
| Results — [date] | Archived weekly results (one per week) |
| Sales Reports | Which reps submitted vs. missing |
| Sales Data Results | Consolidated metrics by community |
| System Log | Automation audit trail |

### Auth Pattern

Uses `google-auth-library` with direct `fetch` calls to the Sheets API (not the heavy `googleapis` package — that caused Vercel cold start timeouts).

```javascript
// api/_lib/sheets.js
import { GoogleAuth } from 'google-auth-library';

const auth = new GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
```

All sheet operations (read, write, append, clear, batchUpdate) go through helper functions in `sheets.js`.

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/get-reps` | GET | Sorted list of active rep names (from Weekly Assignments cache) |
| `/api/get-assignments?rep=Name` | GET | Projects assigned to a rep (with thirdParty flag) |
| `/api/get-prospects?rep=Name` | GET | Active prospects for a rep (excludes sold/removed) |
| `/api/get-last-sync` | GET | Timestamp of last Monday night sync |
| `/api/save-prospect` | POST | Upsert a prospect (by ID) |
| `/api/submit-weekly-log` | POST | Submit a rep's full weekly report |
| `/api/monday-night` | POST | Weekly consolidation (`{"phase":1}` or `{"phase":2}`) |

**Vercel limit:** 7 routes (Hobby plan max is 12).

**Error handling:** All routes catch errors and return generic messages (no stack traces exposed). Errors logged server-side via `console.error`.

**Retry logic:** Frontend `api.js` retries 3 times with exponential backoff (1s, 2s, 4s). 4xx errors fail immediately.

---

## Monday Night Automation

**Cron:** `30 14 * * 1` = Monday 10:30 AM ET (14:30 UTC)

### Phase 1 — Submission Status Report
- Reads all reps from Assignments sheet (skips N/A, none, blank)
- Checks Submissions tab for who submitted this week
- Writes "Sales Reports" tab: rep name, submitted/missing, timestamp

### Phase 2 — Consolidate + Cache + Results
1. **Cache assignments** — reads Assignments sheet, writes "Weekly Assignments" tab (filtered, fast)
2. **Consolidate** — aggregates submissions + prospects into "Sales Data Results" tab
3. **Write weekly results** — builds "Last Weeks Results" with rep data + OSC data, archives previous week as "Results — [date]"

**Chaining:** Phase 1 fires Phase 2 via fire-and-forget `fetch`. Can also trigger phases independently for testing:
```bash
curl -X POST https://copper-builders-log.vercel.app/api/monday-night \
  -H "Content-Type: application/json" -d '{"phase":1}'
```

---

## Key Design Decisions

### Why Google Sheets instead of a database?
- Sales manager needs to view and edit data directly
- No migration or schema management needed
- Familiar interface for non-technical users
- Free tier is sufficient for this scale

### Why google-auth-library instead of googleapis?
- `googleapis` package is ~50MB, caused Vercel cold start timeouts (>10s)
- `google-auth-library` is ~2MB, cold starts in <3s
- Same functionality via direct `fetch` calls to Sheets API

### Why cache assignments locally?
- Reduces Sheets API calls on every page load
- App loads faster (reads from same sheet as submissions)
- Cache refreshed weekly on Monday night

### Why "Last Weeks Results" instead of writing to Assignments sheet?
- Sales manager edits assignments (add/remove reps, communities)
- If results were in the same sheet, edits would corrupt the data
- Separate tab with stable name for external tools to reference
- Archived each week for historical tracking

---

## Deployment

### Vercel Configuration (vercel.json)
```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "crons": [{ "path": "/api/monday-night", "schedule": "30 14 * * 1" }],
  "headers": [{
    "source": "/api/(.*)",
    "headers": [
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "X-Frame-Options", "value": "DENY" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
    ]
  }]
}
```

### Environment Variables on Vercel
Set these in Vercel project settings → Environment Variables (all environments):
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `SALES_APP_SHEET_ID`
- `ASSIGNMENTS_SHEET_ID`
- `TEMPLATE_SHEET_ID`

### Deploying Changes
```bash
git add .
git commit -m "Description of change"
git push origin main    # Auto-deploys to Vercel in ~30 seconds
```

To force a fresh deploy if caching issues occur:
```bash
npx vercel deploy --prod --force
```

---

## Common Tasks

### Refresh assignments cache now
```bash
curl -X POST https://copper-builders-log.vercel.app/api/monday-night \
  -H "Content-Type: application/json" -d '{"phase":2}'
```

### Manually run weekly consolidation
```bash
# Phase 1: submission report
curl -X POST https://copper-builders-log.vercel.app/api/monday-night \
  -H "Content-Type: application/json" -d '{"phase":1}'

# Phase 2: consolidate + cache + results
curl -X POST https://copper-builders-log.vercel.app/api/monday-night \
  -H "Content-Type: application/json" -d '{"phase":2}'
```

### Check if the app is working
```bash
curl https://copper-builders-log.vercel.app/api/get-reps
```

### View function logs
```bash
npx vercel logs https://copper-builders-log.vercel.app --follow
```

---

## Submission Data Structure

What gets written to the Submissions tab when a rep submits:

| Column | Field |
|--------|-------|
| A | Timestamp (ISO) |
| B | Week Ending (e.g., "Mar 29") |
| C | Rep Name |
| D | Community |
| E | Section Type |
| F | Appts Virtual |
| G | Appts In Person |
| H | Total Appts |
| I | Direct Leads Digital |
| J | Direct Leads Phone Call |
| K | Direct Leads In Person |
| L | Active Prospects |
| M | Sold Prospects |
| N | Removed Prospects |
| O | Grand Total Appts |

---

*For user-facing documentation, see [COPPER_BUILDERS_REPORTING_BRIEF.md](COPPER_BUILDERS_REPORTING_BRIEF.md)*
