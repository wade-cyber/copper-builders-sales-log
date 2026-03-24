# Copper Builders — Weekly Sales Log

**Last Updated:** March 24, 2026

---

## Quick Links

| Resource | Link |
|----------|------|
| **Sales Log App** | [copper-builders-log.vercel.app](https://copper-builders-log.vercel.app/) |
| **Sales App Reporting** (Assignments, Submissions, Prospects) | [Google Sheet](https://docs.google.com/spreadsheets/d/1WRPxRr6xU2h0lOw20s1NkMk5gk1pgYh_2LNAUcvUxU4) |
| **Copper Leads Reporting** (Weekly Lead Dashboard) | [Google Sheet](https://docs.google.com/spreadsheets/d/1eH15Te0Wd1nuMMQ-yL0bvtxuYKAcPLv33CYjYylNEeI) |
| **Sales Dashboard Data** (Consolidated Results) | [Google Sheet](https://docs.google.com/spreadsheets/d/1az7HktTLeeQCcCV5f5hgPDyRElyJKzezZymgywc6Gzw) |
| **GitHub Repo** | [wade-cyber/copper-builders-sales-log](https://github.com/wade-cyber/copper-builders-sales-log) |

---

## What This System Does

The Weekly Sales Log captures sales rep activity across all Copper Builders communities each week:

- **Appointments** — logged by type (Client-only, Realtor+Client, Realtor-only) and channel (Virtual, Onsite, Model)
- **Prospects** — tracked with ranking (A/B/C), next steps, and status (Active, Sold, Removed)
- **Special Programs** — BOYL and Renovations, broken out by market (CLT, TRN, GVL)
- **Weekly Dashboards** — auto-consolidated into the Copper Leads sheet every Tuesday

---

## How Reps Use the App

### 1. Select Your Name

Open [the app](https://copper-builders-log.vercel.app/) and choose your name from the dropdown. Your assigned communities load automatically from Smartsheet.

### 2. Log Appointments

For each community, fill in the 3x3 appointment grid:

|                    | Virtual | Onsite | Model |
|--------------------|---------|--------|-------|
| **Client-only**    | _       | _      | _     |
| **Realtor+Client** | _       | _      | _     |
| **Realtor-only**   | _       | _      | _     |

Numbers are cumulative for the week.

### 3. Manage Prospects

Under each community, add or update prospects:
- **Name** — prospect's name
- **Ranking** — A (hot), B (warm), C (cold)
- **Next Step** — follow-up action
- Mark as **Sold** or **Remove** when appropriate

### 4. Submit

Hit **Submit Weekly Log** at the bottom. You'll see a confirmation with your totals.

> **BOYL / Renovations:** If you log appointments for these, you must select a market (CLT, TRN, or GVL) before submitting.

---

## Where the Data Lives

### [Sales App Reporting](https://docs.google.com/spreadsheets/d/1WRPxRr6xU2h0lOw20s1NkMk5gk1pgYh_2LNAUcvUxU4)

| Tab | What's In It |
|-----|-------------|
| **Assignments** | Rep-to-community mapping (synced from Smartsheet every Monday) |
| **Submissions** | Every weekly log submission — one row per community per rep per week |
| **Prospects** | All prospects with ranking, next step, status, and dates |
| **System Log** | Automated action log (syncs, dashboard creation, etc.) |

### [Copper Leads Reporting](https://docs.google.com/spreadsheets/d/1eH15Te0Wd1nuMMQ-yL0bvtxuYKAcPLv33CYjYylNEeI)

| Tab | What's In It |
|-----|-------------|
| **Dashboard** | Current week's lead data — communities, lead sources, totals |
| **Week of [date]** tabs | Archived weekly snapshots (one per past week) |

### [Sales Dashboard Data](https://docs.google.com/spreadsheets/d/1az7HktTLeeQCcCV5f5hgPDyRElyJKzezZymgywc6Gzw)

| Tab | What's In It |
|-----|-------------|
| **Sales Data Results** | Consolidated view — prospects, appointments, leads by community |
| **Sales Reports** | Which reps submitted their Sales Log + whether Leads Report is complete |

---

## Automated Weekly Schedule

| When | What Happens |
|------|-------------|
| **Monday 4:00 AM ET** | Smartsheet sync — pulls latest rep/community assignments, creates next week's Dashboard tab |
| **Wednesday–Friday** | Reps submit their weekly logs via the app |
| **Tuesday 5:00 AM ET** | Dashboard consolidation — aggregates all submissions into Sales Data Results + Sales Reports |

---

## For Management

The **Sales Reports** tab in the [Sales Dashboard Data](https://docs.google.com/spreadsheets/d/1az7HktTLeeQCcCV5f5hgPDyRElyJKzezZymgywc6Gzw) sheet shows at a glance:

- Which reps submitted their Sales Log this week (**Submitted** vs **MISSING**)
- Whether the Leads Report is complete (**COMPLETE** vs **NOT SUBMITTED**)

The **Sales Data Results** tab shows consolidated numbers per community:
- Active Prospects
- Appointments Held
- Total New Leads, Digital Leads, In-Person Leads, Call Leads
- VIP List Signups

---

## Troubleshooting

### "Can't load assignments" or app shows spinner forever
1. Refresh the page (Cmd+R)
2. Check that the [Sales App Reporting](https://docs.google.com/spreadsheets/d/1WRPxRr6xU2h0lOw20s1NkMk5gk1pgYh_2LNAUcvUxU4) sheet is accessible
3. If assignments look stale (8+ days old), the Monday sync may have failed — contact admin

### "Prospect won't save"
1. Make sure all required fields are filled (name is required)
2. Wait a minute and retry — Google Sheets may be rate-limited
3. Open browser console (F12) to see error details

### "My submission isn't showing up"
1. Open the [Submissions tab](https://docs.google.com/spreadsheets/d/1WRPxRr6xU2h0lOw20s1NkMk5gk1pgYh_2LNAUcvUxU4/edit#gid=0) and scroll to the bottom
2. Check the "Week Ending" column for this week's date
3. Remove any active filters: Data → Filter → Reset

### "Dashboard numbers look wrong"
1. Consolidation runs Tuesday at 5 AM — numbers won't reflect late submissions until next Tuesday
2. Check the [Dashboard tab](https://docs.google.com/spreadsheets/d/1eH15Te0Wd1nuMMQ-yL0bvtxuYKAcPLv33CYjYylNEeI) directly to verify lead entry data
3. Duplicate submissions are automatically deduplicated (latest wins per rep+community)

---

## Technical Overview

For anyone maintaining or extending the system:

### Stack
- **Frontend:** React 19 + Vite, hosted on Vercel
- **Backend:** Vercel serverless functions (`/api/*`), no separate server
- **Data:** Google Sheets via Sheets API v4 (service account auth)
- **Assignments Source:** Smartsheet API
- **Deployment:** `git push` to GitHub → auto-deploys to Vercel

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/get-reps` | GET | List all rep names |
| `/api/get-assignments?rep=Name` | GET | Get a rep's communities |
| `/api/get-prospects?rep=Name` | GET | Get a rep's active prospects |
| `/api/get-last-sync` | GET | Last Smartsheet sync timestamp |
| `/api/save-prospect` | POST | Create or update a prospect |
| `/api/submit-weekly-log` | POST | Submit a rep's weekly report |
| `/api/sync-assignments` | POST | Write assignments to Sheets |
| `/api/create-weekly-dashboard` | POST | Create next week's Dashboard tab |
| `/api/consolidate-dashboard` | POST | Aggregate data into Results sheet |
| `/api/sync-smartsheet` | POST/Cron | Full Smartsheet sync + dashboard creation |

### Environment Variables (Vercel)

| Variable | Purpose |
|----------|---------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account for Sheets API access |
| `GOOGLE_PRIVATE_KEY` | Service account private key |
| `SALES_APP_SHEET_ID` | Sales App Reporting sheet ID |
| `LEADS_SHEET_ID` | Copper Leads Reporting sheet ID |
| `RESULTS_SHEET_ID` | Sales Dashboard Data sheet ID |
| `SMARTSHEET_API_TOKEN` | Smartsheet API key for assignment sync |
| `SMARTSHEET_SHEET_ID` | Smartsheet sheet ID to pull from |

### Key Files

```
copper-builders-sales-log/
├── api/
│   ├── _lib/
│   │   ├── sheets.js                  # Shared Google Sheets auth + helpers
│   │   ├── sync-assignments.js        # Assignment sync logic
│   │   └── create-weekly-dashboard.js  # Dashboard creation logic
│   ├── get-reps.js                    # GET /api/get-reps
│   ├── get-assignments.js             # GET /api/get-assignments
│   ├── get-prospects.js               # GET /api/get-prospects
│   ├── get-last-sync.js               # GET /api/get-last-sync
│   ├── save-prospect.js               # POST /api/save-prospect
│   ├── submit-weekly-log.js           # POST /api/submit-weekly-log
│   ├── sync-assignments.js            # POST /api/sync-assignments
│   ├── create-weekly-dashboard.js     # POST /api/create-weekly-dashboard
│   ├── consolidate-dashboard.js       # POST /api/consolidate-dashboard (cron)
│   └── sync-smartsheet.js             # POST /api/sync-smartsheet (cron)
├── src/
│   ├── App.jsx                        # Main app component
│   ├── components/                    # UI components
│   └── utils/
│       ├── api.js                     # Frontend API calls
│       ├── constants.js               # Prospect next-step options
│       └── dates.js                   # Week-ending date math
├── vercel.json                        # Cron schedule config
└── package.json
```

---

*Last Updated: March 24, 2026*
