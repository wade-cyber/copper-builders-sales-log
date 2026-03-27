# Copper Builders — Weekly Sales Reporting Tool

**Last Updated:** March 27, 2026

---

## Quick Links

| Resource | Link |
|----------|------|
| **Sales Log App** | [copper-builders-log.vercel.app](https://copper-builders-log.vercel.app/) |
| **Sales App Reporting** (data storage) | [Google Sheet](https://docs.google.com/spreadsheets/d/1WRPxRr6xU2h0lOw20s1NkMk5gk1pgYh_2LNAUcvUxU4) |
| **Sales Rep Assignments** (managed by sales manager) | [Google Sheet](https://docs.google.com/spreadsheets/d/1vCDaPFo-R_2Wpv2lfGtjA8Q6XeJx1_D0abAC0y3eq3Y) |
| **OSC Leads Report** (filled by OSC weekly) | [Google Sheet](https://docs.google.com/spreadsheets/d/1K5sEUqfu3Z7bYUUCEJSfZPfbaPGCpg4iFYx8YQLT-BU) |
| **GitHub Repo** | [wade-cyber/copper-builders-sales-log](https://github.com/wade-cyber/copper-builders-sales-log) |

---

## What This Tool Does

A standalone web app where sales reps submit their weekly activity. Each week, reps report:

- **New leads received** — digital, phone call, and in-person
- **Appointments held** — virtual and in-person
- **Prospects** — add, rank (A/B/C), and track prospects per project
- **Sales** — mark a prospect as "Sold" to log a sale (with optional lot number)

On Monday night, the system automatically consolidates all rep submissions and OSC lead data into a weekly results report.

---

## How It Works

### For Sales Reps

1. Open [copper-builders-log.vercel.app](https://copper-builders-log.vercel.app/) on any device
2. Select your name from the dropdown
3. For each assigned project:
   - Enter new leads received (digital, phone call, in person)
   - Enter appointments held (virtual, in person)
   - Add/update prospects (name, ranking, optional lot number)
   - Mark prospects as "Sold" to log a sale
4. Click **Submit Weekly Log**

### For the Sales Manager

Manage assignments in the [Sales Rep Assignments](https://docs.google.com/spreadsheets/d/1vCDaPFo-R_2Wpv2lfGtjA8Q6XeJx1_D0abAC0y3eq3Y) Google Sheet:

| Column | What It Does |
|--------|-------------|
| **A: Rep Name** | The sales rep's name (use "N/A" or leave blank for leads-only communities) |
| **B: Community or House Name** | The project/community name |
| **C: Division** | Market code (CLT, TRN, GVL, CLB, WIL) |

- Add or remove rows to change assignments
- Reps with "N/A", "none", or blank names won't appear in the app — their communities are tracked for OSC leads only
- Changes take effect after the Monday night sync

### For the OSC

Fill out the [OSC Leads Report](https://docs.google.com/spreadsheets/d/1K5sEUqfu3Z7bYUUCEJSfZPfbaPGCpg4iFYx8YQLT-BU) each week:

| Column | Data |
|--------|------|
| **A: Community** | Pre-filled community names |
| **C: Total Digital** | Digital lead count |
| **D: Total In Person** | In-person lead count |
| **E: Total Calls** | Call-in lead count |

---

## Monday Night Automation

Every Monday at **12:00 AM ET** (5:00 AM UTC), the system automatically runs two phases:

### Phase 1: Submission Status Report
- Checks which reps submitted their weekly log
- Writes "Sales Reports" tab showing Submitted vs. MISSING per rep

### Phase 2: Consolidate + Cache + Results
- **Caches assignments** from the Sales Rep Assignments sheet into the app for fast loading
- **Consolidates all data** into the "Sales Data Results" tab (by community)
- **Writes "Last Weeks Results"** tab with the full weekly report:
  - Archives previous week's results as "Results — [date]"
  - Creates fresh results combining rep data + OSC data

---

## Where Data Lives

### Sales App Reporting Sheet

| Tab | Purpose |
|-----|---------|
| **Submissions** | Raw weekly log entries from reps (appointments, leads, prospects) |
| **Prospects** | Full prospect/sales pipeline (name, ranking, lot number, status) |
| **Weekly Assignments** | Cached copy of assignments for fast app loading |
| **Last Weeks Results** | Current week's consolidated results (stable tab name for other tools) |
| **Results — [date]** | Archived weekly results (one per week, historical) |
| **Sales Reports** | Which reps submitted vs. missing |
| **Sales Data Results** | Consolidated metrics by community |
| **System Log** | Automated action audit trail |

### Last Weeks Results Columns

| Column | Data |
|--------|------|
| A: Week Ending | Week ending date |
| B: Rep Name | Sales rep |
| C: Community | Project/community name |
| D: Division | Market code |
| E: Report Date | When the rep submitted |
| F: Sales | Number of prospects marked "Sold" |
| G: Prospects | Active prospect count |
| H: Appts Held | Total appointments |
| I: Sales Rep Leads | Rep's direct leads (digital + phone + in-person) |
| J: OSC Digital Leads | OSC digital leads |
| K: OSC In Person Leads | OSC in-person leads |
| L: OSC Call-In Leads | OSC call-in leads |
| M: Total Leads | All leads combined (rep + OSC) |

---

## Technical Stack

- **Frontend:** React 19 + Vite, hosted on Vercel
- **Backend:** Vercel serverless functions (7 API routes)
- **Data:** Google Sheets via Sheets API v4 (service account auth)
- **Auth library:** google-auth-library (lightweight, fast cold starts)
- **Deployment:** Auto-deploys via `git push` to GitHub

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/get-reps` | GET | List all active rep names |
| `/api/get-assignments?rep=Name` | GET | Get a rep's assigned projects |
| `/api/get-prospects?rep=Name` | GET | Get a rep's active prospects |
| `/api/get-last-sync` | GET | Last assignment sync timestamp |
| `/api/save-prospect` | POST | Create or update a prospect |
| `/api/submit-weekly-log` | POST | Submit a rep's weekly report |
| `/api/monday-night` | POST/Cron | Monday night consolidation |

### Environment Variables (Vercel)

| Variable | Purpose |
|----------|---------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account for Sheets API |
| `GOOGLE_PRIVATE_KEY` | Service account private key |
| `SALES_APP_SHEET_ID` | Sales App Reporting sheet |
| `ASSIGNMENTS_SHEET_ID` | Sales Rep Assignments sheet |
| `TEMPLATE_SHEET_ID` | OSC Leads Report sheet |

---

## Troubleshooting

### "Can't see rep names in dropdown"
- The Weekly Assignments cache may be empty. Trigger a sync: `POST /api/monday-night` with `{"phase":2}`
- Check the Sales Rep Assignments sheet has rep names in column A

### "Rep submitted but data isn't showing"
- Data appears in the "Last Weeks Results" tab after Monday night consolidation runs
- For immediate check, look at the Submissions tab in the Sales App Reporting sheet

### "Community not showing for a rep"
- Check the Sales Rep Assignments sheet — the rep must have a row with that community
- Changes require a Monday night sync to take effect in the app

### "Monday night job failed"
- Check the System Log tab for error details
- Most common: Google Sheets API quota exceeded (wait and retry)
- Can manually trigger: `POST https://copper-builders-log.vercel.app/api/monday-night` with `{"phase":1}` then `{"phase":2}`

---

*Last Updated: March 27, 2026*
