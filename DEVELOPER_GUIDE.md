# Copper Builders Sales Log — Developer Guide

**Last Updated:** April 5, 2026

This guide is for anyone pulling up this codebase for the first time — everything you need to understand, run, and modify the app.

---

## Overview

A standalone web app where sales reps submit weekly activity (leads, appointments, prospects, sales). Data is stored in **Supabase PostgreSQL**. Every Monday at 10:30 AM ET, the system imports OSC leads and rotates the OSC Leads sheet. All reporting is served from the database via the admin dashboard.

**Live App:** https://copper-builders-log.vercel.app/
**Admin Dashboard:** https://copper-builders-log.vercel.app/dashboard.html
**Help Page:** https://copper-builders-log.vercel.app/how-it-works.html
**GitHub:** https://github.com/wade-cyber/copper-builders-sales-log

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 8 |
| Backend | Vercel Serverless Functions (10 routes) |
| Database | Supabase PostgreSQL |
| OSC Leads | Google Sheets API v4 (read/rotate only) |
| API Auth | API key (`x-api-key` header) |
| Auth (Sheets) | google-auth-library (service account) |
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
# Google Sheets (OSC Leads Report only)
GOOGLE_SERVICE_ACCOUNT_EMAIL=copper-builders-sheets@axial-diagram-489522-n6.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
TEMPLATE_SHEET_ID=1K5sEUqfu3Z7bYUUCEJSfZPfbaPGCpg4iFYx8YQLT-BU

# Supabase (primary database)
SUPABASE_URL=https://bhmjgfjybpfgjxwtbked.supabase.co
SUPABASE_SERVICE_KEY=<service_role key from Supabase Settings > API>

# API Authentication
API_SECRET=<random secret>
VITE_API_SECRET=<same as API_SECRET>
CRON_SECRET=<random secret for Vercel cron>
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
│   │   ├── auth.js                   # API key + cron authentication
│   │   ├── db.js                     # Supabase client
│   │   ├── sheets.js                 # Google Sheets API wrapper + date utilities
│   │   ├── assignments-queries.js    # Community + rep queries from Supabase
│   │   ├── import-osc-leads.js       # Shared OSC lead import logic
│   │   ├── resolve-names.js          # Community/rep name → DB ID resolution
│   │   ├── logger.js                 # Structured logging to run_log/error_log
│   │   └── retry.js                  # Exponential backoff wrapper
│   ├── get-reps.js                   # GET — list rep names
│   ├── get-assignments.js            # GET — rep's assigned projects
│   ├── get-prospects.js              # GET — rep's prospect pipeline
│   ├── get-last-sync.js              # GET — last sync timestamp
│   ├── save-prospect.js              # POST — create/update prospect
│   ├── submit-weekly-log.js          # POST — submit weekly report
│   ├── monday-night.js               # POST/Cron — OSC import + sheet rotation
│   ├── reports.js                    # GET — consolidated reporting (9 report types)
│   ├── admin.js                      # GET/POST — admin CRUD operations
│   ├── health.js                     # GET — system health check (no auth required)
│   └── import-leads.js               # POST — reimport OSC leads manually
│
├── db/
│   ├── migrations/                   # SQL schema files (run in Supabase SQL Editor)
│   │   ├── 000_run_all.sql           # Combined migration (all tables)
│   │   └── 001-007_*.sql             # Individual table migrations
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
│   │   └── useProspects.js           # Fetch rep's prospects (debounced saves)
│   └── utils/
│       ├── api.js                    # API calls with retry logic + API key
│       └── dates.js                  # Week ending calculations
│
├── public/
│   ├── dashboard.html                # Admin dashboard (6 tabs: Results, Communities, Reps, Assignments, System, Help)
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

---

## API Routes (10 total)

All routes except `/api/health` require an `x-api-key` header matching the `API_SECRET` env var.

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/get-reps` | GET | Sorted list of active rep names |
| `/api/get-assignments?rep=Name` | GET | Projects assigned to a rep |
| `/api/get-prospects?rep=Name` | GET | Active prospects for a rep |
| `/api/get-last-sync` | GET | Timestamp of last sync from run_log |
| `/api/save-prospect` | POST | Create or update a prospect |
| `/api/submit-weekly-log` | POST | Submit weekly report |
| `/api/monday-night` | POST | Monday automation (Phase 1 → Phase 2) |
| `/api/reports?type=...` | GET | 9 report types (see below) |
| `/api/admin?action=...` | GET/POST | Admin CRUD (communities, reps, assignments, jobs) |
| `/api/health` | GET | System health check (no auth required) |
| `/api/import-leads` | POST | Reimport OSC leads from Google Sheet |

### Report Types (`/api/reports?type=`)
`weekly-summary`, `non-reporters`, `rep-activity`, `division-summary`, `lead-summary`, `trends`, `submission-timeline`, `community-detail`, `community-results`

### Admin Actions (`/api/admin?action=`)
`list-communities`, `upsert-community`, `list-reps`, `upsert-rep`, `list-assignments`, `set-assignments`, `remove-assignment`, `trigger-job`, `run-history`, `error-log`

---

## Monday Morning Automation

**Cron:** `30 14 * * 1` = Monday 10:30 AM ET (14:30 UTC)

### Phase 1 — Submission Status Report
- Reads assigned reps from Supabase for the current week
- Checks Supabase for who submitted
- Logs results to `run_log`
- Chains to Phase 2 automatically

### Phase 2 — Import OSC Leads + Rotate OSC Sheet
1. **Import OSC leads** — reads "This Week's Report" tab from OSC Leads Report Google Sheet, imports lead counts + VIP into Supabase `leads` table
2. **Rotate OSC leads sheet** — archives "This Week's Report" as "Week of [date]", duplicates Dashboard Template to create fresh "This Week's Report", updates week ending date, syncs communities, clears data columns

All consolidation and reporting is handled by the admin dashboard reading directly from Supabase.

### OSC Leads Sheet Details
- **Dashboard Template** — master template, never modified directly
- **"This Week's Report"** — fresh duplicate created each week for the OSC to fill in
- Communities synced to rows 13+ (A:B), data cleared in G:AM with blank strings

### Manual Triggers
```bash
# Phase 1 + Phase 2 (full run)
curl -X POST https://copper-builders-log.vercel.app/api/monday-night \
  -H "x-api-key: <API_SECRET>" \
  -H "Content-Type: application/json" -d '{"phase":1}'

# Phase 2 only (OSC import + rotate)
curl -X POST https://copper-builders-log.vercel.app/api/monday-night \
  -H "x-api-key: <API_SECRET>" \
  -H "Content-Type: application/json" -d '{"phase":2}'

# Reimport OSC leads only
curl -X POST https://copper-builders-log.vercel.app/api/import-leads \
  -H "x-api-key: <API_SECRET>"
```

Or use the Admin Dashboard → System tab → trigger buttons.

---

## Key Design Decisions

### Why Supabase?
- Free tier generous (500MB, 50K rows)
- Hosted with REST API — works well with Vercel serverless
- Built-in dashboard for ad-hoc queries
- `@supabase/supabase-js` is lightweight (~2MB)

### Why a static dashboard.html instead of React routing?
- Keeps the rep-facing form completely untouched
- No new dependencies (no react-router)
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
| `TEMPLATE_SHEET_ID` | OSC Leads Report sheet |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service_role key |
| `API_SECRET` | API key for all endpoints |
| `VITE_API_SECRET` | Same as API_SECRET (baked into frontend build) |
| `CRON_SECRET` | Vercel cron authentication |

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
- **12 serverless functions max** — currently using 10
- **1 daily cron max** — Monday morning job (OSC import + rotation)
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
curl -H "x-api-key: <API_SECRET>" \
  "https://copper-builders-log.vercel.app/api/reports?type=community-results"
```

### Add a new community
Admin Dashboard → Communities tab → fill in name + division → Add Community

### Add a new rep
Admin Dashboard → Reps tab → fill in name → Add Rep

### Assign a rep to a community
Admin Dashboard → Assignments tab → select rep, community → Assign

### View Vercel function logs
```bash
npx vercel logs https://copper-builders-log.vercel.app --follow
```

---

*For user-facing documentation, see [COPPER_BUILDERS_REPORTING_BRIEF.md](COPPER_BUILDERS_REPORTING_BRIEF.md)*
