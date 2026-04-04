# Copper Builders Sales Log — Developer Guide

**Last Updated:** April 4, 2026

This guide is for anyone pulling up this codebase for the first time — everything you need to understand, run, and modify the app.

---

## Overview

A standalone web app where sales reps submit weekly activity (leads, appointments, prospects, sales). Data is dual-written to **Supabase PostgreSQL** (primary) and **Google Sheets** (backward-compatible). Every Monday at 10:30 AM ET, the system consolidates all submissions into a weekly results report.

**Live App:** https://copper-builders-log.vercel.app/
**Admin Dashboard:** https://copper-builders-log.vercel.app/dashboard.html
**Help Page:** https://copper-builders-log.vercel.app/how-it-works.html
**GitHub:** https://github.com/wade-cyber/copper-builders-sales-log

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 8 |
| Backend | Vercel Serverless Functions (11 routes) |
| Primary Database | Supabase PostgreSQL |
| Legacy Data | Google Sheets API v4 |
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
Copy `.env.example` to `.env` and fill in the values. Required variables:

```
# Google Sheets (backward-compatible writes)
GOOGLE_SERVICE_ACCOUNT_EMAIL=copper-builders-sheets@axial-diagram-489522-n6.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
SALES_APP_SHEET_ID=1WRPxRr6xU2h0lOw20s1NkMk5gk1pgYh_2LNAUcvUxU4
ASSIGNMENTS_SHEET_ID=1vCDaPFo-R_2Wpv2lfGtjA8Q6XeJx1_D0abAC0y3eq3Y
TEMPLATE_SHEET_ID=1K5sEUqfu3Z7bYUUCEJSfZPfbaPGCpg4iFYx8YQLT-BU

# Supabase (primary database)
SUPABASE_URL=https://bhmjgfjybpfgjxwtbked.supabase.co
SUPABASE_SERVICE_KEY=<service_role key from Supabase Settings > API>
```

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
│   │   ├── db.js                     # Supabase client (primary database)
│   │   ├── sheets.js                 # Google Sheets API wrapper + date utilities
│   │   ├── resolve-names.js          # Community/rep name → DB ID resolution
│   │   ├── sync-from-assignments-sheet.js  # Read/filter assignments from Sheets
│   │   ├── logger.js                 # Structured logging to run_log/error_log
│   │   └── retry.js                  # Exponential backoff wrapper
│   ├── get-reps.js                   # GET — list rep names
│   ├── get-assignments.js            # GET — rep's assigned projects
│   ├── get-prospects.js              # GET — rep's prospect pipeline
│   ├── get-last-sync.js              # GET — last sync timestamp
│   ├── save-prospect.js              # POST — create/update prospect (dual-write)
│   ├── submit-weekly-log.js          # POST — submit weekly report (dual-write)
│   ├── monday-night.js               # POST/Cron — weekly consolidation + OSC rotation
│   ├── reports.js                    # GET — consolidated reporting (8 report types)
│   ├── admin.js                      # GET/POST — admin CRUD operations
│   ├── health.js                     # GET — system health check
│   └── import-leads.js               # POST — import OSC leads to database
│
├── db/
│   ├── migrations/                   # SQL schema files (run in Supabase SQL Editor)
│   │   ├── 000_run_all.sql           # Combined migration (all tables)
│   │   ├── 001-007_*.sql             # Individual table migrations
│   └── seed.js                       # Seed communities + reps from live app
│
├── src/
│   ├── App.jsx                       # Main app (state, submission flow)
│   ├── main.jsx                      # React entry point
│   ├── index.css                     # All styles (responsive)
│   ├── components/
│   │   ├── Header.jsx                # App header with Help button
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
│   ├── dashboard.html                # Admin dashboard (5 tabs: Results, Communities, Reps, Assignments, System)
│   └── how-it-works.html             # User help page (with Loom video)
│
├── vercel.json                       # Cron schedule + security headers
├── package.json                      # Dependencies + scripts
└── COPPER_BUILDERS_REPORTING_BRIEF.md  # User/manager documentation
```

---

## Database (Supabase PostgreSQL)

### Tables

| Table | Purpose |
|-------|---------|
| `communities` | Master list with name, division (CLT/TRN/GVL/etc), active status |
| `reps` | Sales rep records with name, email, active status |
| `assignments` | Weekly rep→community assignments (unique per rep+community+week) |
| `weekly_submissions` | Form submissions with granular fields (appts by type, leads by source, prospect counts) |
| `prospects` | Individual prospect records (name, ranking A/B/C, next step, status, lot number) |
| `leads` | OSC lead data by community and week (digital, phone, in-person, VIP count in notes JSON) |
| `run_log` | Job execution history (type, status, timing, errors) |
| `error_log` | Granular error tracking linked to runs |

### Schema location
SQL files in `db/migrations/`. The combined file `000_run_all.sql` can be pasted into the Supabase SQL Editor to recreate all tables.

### Dual-Write Architecture
During the migration period, all writes go to **both** Supabase and Google Sheets:
- Supabase write happens first (primary)
- If Supabase fails, Google Sheets write continues as fallback
- If Sheets fails, the submission is still saved in Supabase
- Zero data loss in either failure mode

---

## API Routes (12 total, Hobby plan max is 12)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/get-reps` | GET | Sorted list of active rep names |
| `/api/get-assignments?rep=Name` | GET | Projects assigned to a rep |
| `/api/get-prospects?rep=Name` | GET | Active prospects for a rep |
| `/api/get-last-sync` | GET | Timestamp of last Monday night sync |
| `/api/save-prospect` | POST | Upsert prospect (dual-write: Supabase + Sheets) |
| `/api/submit-weekly-log` | POST | Submit weekly report (dual-write: Supabase + Sheets) |
| `/api/monday-night` | POST | Weekly consolidation (`{"phase":1}` or `{"phase":2}`) |
| `/api/reports?type=...` | GET | 9 report types (see below) |
| `/api/admin?action=...` | GET/POST | Admin CRUD (communities, reps, assignments, jobs) |
| `/api/health` | GET | System health check |
| `/api/import-leads` | POST | Import OSC leads from Sheets to DB. Accepts `{"tab":"Week of Mar 22, 2026","week_ending":"2026-03-29"}` for historical imports |
| `/api/backfill-db` | POST | Backfill submissions from Google Sheets into Supabase. Also supports `{"action":"migrate"}` to check schema status |

### Report Types (`/api/reports?type=`)
`weekly-summary`, `non-reporters`, `rep-activity`, `division-summary`, `lead-summary`, `trends`, `submission-timeline`, `community-detail`, `community-results`

### Admin Actions (`/api/admin?action=`)
`list-communities`, `upsert-community`, `list-reps`, `upsert-rep`, `list-assignments`, `set-assignments`, `remove-assignment`, `trigger-job`, `run-history`, `error-log`

---

## Monday Night Automation

**Cron:** `30 14 * * 1` = Monday 10:30 AM ET (14:30 UTC)

### Phase 1 — Submission Status Report
- Reads all reps from Assignments sheet
- Checks Submissions tab for who submitted this week
- Writes "Sales Reports" tab: rep name, submitted/missing, timestamp

### Phase 2 — Consolidate + Cache + Results + OSC Rotation
1. **Cache assignments** — reads Assignments sheet, writes "Weekly Assignments" tab + syncs to Supabase
2. **Consolidate** — aggregates submissions into "Sales Data Results" tab
3. **Write weekly results** — builds "Last Weeks Results" with rep + OSC data, archives previous week
4. **Rotate OSC leads sheet** — archives "This Week's Report" as "Week of [date]", duplicates Dashboard Template to create fresh "This Week's Report", updates week ending date, syncs communities, clears data columns (blanks, not zeros)

### OSC Leads Sheet Details
- **Dashboard Template** — master template, never modified directly
- **"This Week's Report"** — fresh duplicate created each week for the OSC to fill in
- Protected areas (on Dashboard Template): rows 4-6, columns C-F, cells A7:B12
- The weekly duplicate inherits these protections but the code only writes to unprotected areas
- Communities synced to rows 13+ (A:B), data cleared in G:AM with blank strings

### Manual Triggers
```bash
# Phase 1 only (submission report)
curl -X POST https://copper-builders-log.vercel.app/api/monday-night \
  -H "Content-Type: application/json" -d '{"phase":1}'

# Phase 2 (full consolidation)
curl -X POST https://copper-builders-log.vercel.app/api/monday-night \
  -H "Content-Type: application/json" -d '{"phase":2}'

# Phase 2 for a specific week
curl -X POST https://copper-builders-log.vercel.app/api/monday-night \
  -H "Content-Type: application/json" -d '{"phase":2,"targetDate":"2026-03-29"}'

# Import OSC leads to database
curl -X POST https://copper-builders-log.vercel.app/api/import-leads
```

Or use the Admin Dashboard → System tab → trigger buttons.

---

## Key Design Decisions

### Why dual-write (Supabase + Google Sheets)?
- Database is the primary store; Sheets is the fallback during migration
- Sales manager and VP still view data in Google Sheets
- Zero data loss if either system fails
- Will remove Sheets reads in a future phase once DB is fully proven

### Why Supabase instead of raw PostgreSQL?
- Free tier generous (500MB, 50K rows)
- Hosted with REST API — works well with Vercel serverless
- Built-in dashboard for ad-hoc queries
- `@supabase/supabase-js` is lightweight (~2MB)

### Why a static dashboard.html instead of React routing?
- Keeps the rep-facing form completely untouched
- No new dependencies (no react-router)
- Stays within Vercel Hobby plan's 12-function limit
- Same deployment — just a static HTML file in `public/`

### Why "This Week's Report" instead of modifying Dashboard Template?
- Dashboard Template has protected cells that block structural changes
- Duplicating to a fresh tab each week preserves all formatting
- The template stays clean as a master reference
- Archive tabs ("Week of [date]") preserve historical data

---

## Environment Variables (Vercel)

| Variable | Purpose |
|----------|---------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account for Sheets API |
| `GOOGLE_PRIVATE_KEY` | Service account private key |
| `SALES_APP_SHEET_ID` | Sales App Reporting sheet |
| `ASSIGNMENTS_SHEET_ID` | Sales Rep Assignments sheet |
| `TEMPLATE_SHEET_ID` | OSC Leads Report sheet |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service_role key |

---

## Deployment

Auto-deploys on `git push origin main` (~30 seconds).

```bash
git add .
git commit -m "Description of change"
git push origin main
```

Force deploy if needed:
```bash
npx vercel deploy --prod
```

### Vercel Hobby Plan Constraints
- **12 serverless functions max** — currently using 11
- **1 daily cron max** — Monday night job only; lead import and health check are manual
- Best-effort cron scheduling — no guaranteed execution

---

## Common Tasks

### Check system health
```bash
curl https://copper-builders-log.vercel.app/api/health
```

### View weekly results
Open Admin Dashboard → Results tab, or:
```bash
curl "https://copper-builders-log.vercel.app/api/reports?type=community-results"
```

### Add a new community
Admin Dashboard → Communities tab → fill in name + division → Add Community

### Add a new rep
Admin Dashboard → Reps tab → fill in name → Add Rep

### Assign a rep to a community
Admin Dashboard → Assignments tab → select rep, community, week → Assign

### View Vercel function logs
```bash
npx vercel logs https://copper-builders-log.vercel.app --follow
```

---

*For user-facing documentation, see [COPPER_BUILDERS_REPORTING_BRIEF.md](COPPER_BUILDERS_REPORTING_BRIEF.md)*
