# Copper Builders — Weekly Sales Reporting Tool

**Last Updated:** April 5, 2026

---

## Quick Links

| Resource | Link |
|----------|------|
| **Sales Log App** (reps) | [copper-builders-log.vercel.app](https://copper-builders-log.vercel.app/) |
| **Admin Dashboard** (managers) | [copper-builders-log.vercel.app/dashboard.html](https://copper-builders-log.vercel.app/dashboard.html) |
| **Help Page** (reps) | [copper-builders-log.vercel.app/how-it-works.html](https://copper-builders-log.vercel.app/how-it-works.html) |
| **OSC Leads Report** | [Google Sheet](https://docs.google.com/spreadsheets/d/1K5sEUqfu3Z7bYUUCEJSfZPfbaPGCpg4iFYx8YQLT-BU) |
| **GitHub Repo** | [wade-cyber/copper-builders-sales-log](https://github.com/wade-cyber/copper-builders-sales-log) |
| **Supabase Dashboard** | [supabase.com/dashboard/project/bhmjgfjybpfgjxwtbked](https://supabase.com/dashboard/project/bhmjgfjybpfgjxwtbked) |

---

## What This Tool Does

A standalone web app where sales reps submit their weekly activity. Each week, reps report:

- **New leads received** — digital, phone call, and in-person
- **Appointments held** — virtual and in-person
- **Prospects** — add, rank (A/B/C), and track prospects per project
- **Sales** — mark a prospect as "Sold" to log a sale (with optional lot number)

Results are available immediately on the admin dashboard after reps submit.

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
5. Click **Help** button for a walkthrough video and instructions

### For the Sales Manager

Go to the [Admin Dashboard](https://copper-builders-log.vercel.app/dashboard.html) to:
- View weekly results by community (Results tab)
- See who submitted and who hasn't
- Manage communities and reps (Communities / Reps tabs)
- Manage weekly assignments (Assignments tab)
- Trigger jobs manually and view system health (System tab)
- Read the full system guide (Help tab)

### For the OSC

Fill out the **"This Week's Report"** tab in the [OSC Leads Report](https://docs.google.com/spreadsheets/d/1K5sEUqfu3Z7bYUUCEJSfZPfbaPGCpg4iFYx8YQLT-BU) each week with lead counts (digital, phone, in-person) and VIP sign-ups per community. The system imports this data automatically on Mondays and creates a fresh tab for the next week.

---

## Monday Morning Automation

Every Monday at **10:30 AM ET**, the system automatically runs:

### Phase 1 — Submission Status Report
- Checks which reps submitted their weekly log
- Logs results to the database

### Phase 2 — Import OSC Leads + Rotate OSC Sheet
1. **Import OSC leads** from the "This Week's Report" Google Sheet tab into the database
2. **Rotate OSC leads sheet** — archives current "This Week's Report" tab as "Week of [date]", duplicates Dashboard Template to create a fresh "This Week's Report", updates the week ending date, syncs communities, clears data columns

All reporting and consolidation is handled by the admin dashboard reading directly from the database — no Google Sheets output is written.

---

## Data Storage

### Supabase PostgreSQL (single source of truth)
All data is stored in Supabase. The admin dashboard and all reporting reads directly from the database.

| Table | Purpose |
|-------|---------|
| `communities` | Master list of all communities with division codes |
| `reps` | Sales representative records |
| `assignments` | Weekly rep-to-community assignments |
| `weekly_submissions` | Form submission data (appointments, leads, prospects) |
| `prospects` | Individual prospect records with ranking, status, lot number |
| `leads` | OSC lead data by community |
| `run_log` | Automated job run history |
| `error_log` | Error tracking for debugging |

### Google Sheets (OSC Leads Report only)
The only remaining Google Sheet is the **OSC Leads Report**, where the OSC enters weekly marketing lead data. This is imported into the database automatically on Mondays and can be reimported manually from the System tab.

---

## Admin Dashboard

Available at [/dashboard.html](https://copper-builders-log.vercel.app/dashboard.html) with 6 tabs:

| Tab | What It Shows |
|-----|---------------|
| **Results** | Weekly results by community with Prev/Next week navigation. Summary cards (VIP List, OSC Leads, Rep Leads, Appts, Prospects, Sales), non-reporter alerts, community table with OSC and rep data, full prospect pipeline, and last report date per rep. |
| **Communities** | Add/edit/deactivate communities |
| **Reps** | Add/edit/deactivate sales reps |
| **Assignments** | Current rep-to-community assignments (static list with add/remove) |
| **System** | Health status, two manual actions (Weekly Consolidation — auto Monday 10:30 AM ET, includes OSC import, safe to rerun; Reimport OSC Leads — for reimporting if OSC updated after consolidation), run history, error log |
| **Help** | System guide for admin/managers: weekly cycle, what each tab does, common tasks, links to documentation |

---

## Troubleshooting

### "Can't see rep names in dropdown"
- Check the Assignments tab in the Admin Dashboard — the rep must have assignments for the current week
- Make sure the rep is active (Reps tab)

### "Rep submitted but data isn't showing in Results"
- Data appears in the Results tab immediately after reps submit
- Navigate to the correct week using the Prev/Next buttons

### "Community not showing for a rep"
- Check the Assignments tab in the Admin Dashboard — the rep must be assigned to that community for the current week

### "Monday job failed"
- Check Admin Dashboard → System tab for error details
- Most common cause: Google Sheets API quota exceeded (wait and retry)
- Click "Rerun Weekly Consolidation" on the System tab

---

*Last Updated: April 5, 2026*
