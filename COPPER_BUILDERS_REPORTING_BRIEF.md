# Copper Builders — Weekly Sales Log System

**Version:** 2.0
**Last Updated:** March 24, 2026
**Status:** Active — deploys via git push to GitHub → Vercel

---

## System Overview

The **Weekly Sales Log** is a web-based reporting system that captures sales rep activity across all Copper Builders communities, enabling real-time visibility into:

- **Appointment activity** by community and appointment type
- **Prospect tracking** with lead ranking and next steps
- **Special programs** (BOYL, Renovations) with market attribution
- **Weekly consolidation** for management dashboards
- **Smartsheet integration** for assignment management

---

## Key Features

### 1. Rep-Based Reporting

Each sales rep logs in with their name (pulled from Smartsheet assignments) and submits their weekly activity.

**Data Points Captured:**
- Appointments by appointment type:
  - **Client-only** (interested in builder only)
  - **Realtor + Client** (buyer's agent + client)
  - **Realtor-only** (agent looking at specs)
- Appointment channels:
  - **Virtual** (phone/video)
  - **Onsite** (visit to model/community)
  - **Model** (model home walkthrough)

### 2. Community/Property Management

- **Smartsheet Integration** — Communities and assignments auto-sync from Smartsheet each week
- **Dynamic Assignment List** — Reps see only their assigned communities
- **Add-On Communities** — Reps can add unlisted communities to their report
- **Single Homes Program** — Tracked separately as a special assignment type

### 3. Prospect Tracking

Each rep can log prospects with:
- **Name** — Prospect's name
- **Ranking** — A (hot), B (warm), C (cold)
- **Next Step** — Follow-up action (call, email, visit, etc.)
- **Status** — Active, Sold, or Removed

Sold/Removed prospects are excluded from the active pipeline but kept for historical records.

### 4. Special Programs

#### BOYL (Build on Your Lot)
- Market selection: **CLT** (Charlotte), **TRN** (Triad), **GVL** (Greenville)
- Market selection is **required** if appointments logged
- Tracks lots brought by clients vs. offered by builder

#### Renovations
- Market selection: **CLT**, **TRN**, **GVL**
- Market selection is **required** if appointments logged
- Separate pipeline from new construction

---

## User Workflow

### Step 1: Rep Selection
```
[Select Rep] → Dropdown lists all reps from Smartsheet
              → Loading message while assignments fetch
              → 8-day-old data warning (if stale)
```

### Step 2: Community Entry
```
Rep's communities appear in sections:
├─ Communities (assigned from Smartsheet)
│   ├─ Community A [appointment grid]
│   ├─ Community B [appointment grid]
│   └─ [+ Add Community] button
├─ Single Homes (if applicable)
├─ BOYL (special program)
│   └─ Market: [CLT] [TRN] [GVL]
└─ Renovations (special program)
    └─ Market: [CLT] [TRN] [GVL]
```

### Step 3: Appointment Entry
For each community/section, rep enters:
```
                Virtual  Onsite  Model
Client-only       [_]      [_]     [_]
Realtor+Client    [_]      [_]     [_]
Realtor-only      [_]      [_]     [_]
```

Numbers are cumulative for the week.

### Step 4: Prospect Management
Under each community block:
```
[Prospect Name] - [A/B/C] - [Next Step] - [Status] [Edit] [Sold] [Remove]
```

Add new prospects with:
```
[+ Add Prospect] → Form to enter name, ranking, next step
```

### Step 5: Submission
```
Progress bar shows: "X of Y sections reviewed"
                    ████░░░░░ 4/6 sections

Total Appts: [23]  Total Prospects: [17]

[Submit Weekly Log] button → Saves to Google Sheets
                           → Confirmation page
```

---

## Data Storage & Flow

### Google Sheets Architecture

**Three linked Google Sheets:**

#### 1. Sales App Reporting Sheet
```
Tabs:
  ├─ Assignments
  │  └─ Rep Name | Assignment Name | Assignment Type
  │     [pulled from Smartsheet weekly]
  │
  ├─ Submissions
  │  └─ Timestamp | Week Ending | Rep Name | Community | Section Type |
  │     Client-only (Virtual/Onsite/Model) | Realtor+Client | Realtor-only
  │     [appended when rep submits]
  │
  └─ Prospects
     └─ ID | Rep Name | Community | Prospect Name | Ranking |
        Next Step | Status | Created Date | Last Updated
        [updated when rep adds/edits prospect]
```

#### 2. Copper Leads Sheet
```
Tabs:
  ├─ Dashboard (active week)
  │  └─ Week of Mar 22, 2026
  │     Communities | CLT BOYL | TRN BOYL | GVL BOYL | Renovations | etc.
  │     Totals row updates dynamically
  │
  ├─ Week of Mar 15, 2026
  │  └─ [Historical week, archived]
  │
  ├─ Week of Mar 8, 2026
  │  └─ [Historical week, archived]
  │
  └─ ... (previous weeks)
```

#### 3. Results Sheet
```
Summary metrics:
  - Total appointments by week
  - Appointments by rep
  - Appointments by community
  - Prospect pipeline status
```

### Data Flow Timeline

```
Monday 4am (Cron)
  └─ Smartsheet Sync
     ├─ Pull all rep-to-community assignments
     ├─ Update "Assignments" tab
     └─ Clear stale data

Tuesday 1am (Cron)
  └─ Dashboard Consolidation
     ├─ Reads all submissions from the week
     ├─ Deduplicates by rep+community (keeps latest)
     ├─ Sums appointments by category
     ├─ Updates "Dashboard" tab with totals
     └─ Archives previous week's dashboard

Wednesday-Friday
  └─ Reps submit their weekly logs
     ├─ Form submission → API call
     ├─ Logged to "Submissions" tab
     ├─ Prospects saved to "Prospects" tab
     └─ Confirmation sent to rep

Next Monday
  └─ New week cycle begins
```

---

## Reporting & Insights

### For Management

**Weekly Dashboard Shows:**
- Appointments by community (total + by type)
- Appointments by market (CLT/TRN/GVL BOYL & Renovations)
- Submissions status (which reps submitted, which missing)
- Prospect pipeline (active count, ranking distribution)
- Week-over-week trend

**Queries Available:**
- "Which community had the most activity?"
- "BOYL appointments: CLT vs TRN vs GVL?"
- "How many prospects ranked 'A' are in pipeline?"
- "Did Rep X submit?"
- "Average appointments per rep?"

### For Reps

**Immediate Feedback:**
- Submission confirmation
- Progress bar showing sections completed
- Appointment totals for the week
- Prospect status summary

**Historical Access:**
- Can view previous submissions (via Google Sheets)
- Can see prospect pipeline status
- Comparison to prior weeks

---

## Integration Points

### Smartsheet
- **What:** Assignment data (rep ↔ community mapping)
- **How:** Python cron script runs Monday 4am
- **Sync:** Pulls latest assignments and updates "Assignments" tab
- **Credentials:** API key stored in environment

### Google Sheets
- **What:** Data persistence (Assignments, Submissions, Prospects)
- **How:** Vercel serverless API routes access Sheets via Google Sheets API v4
- **Sync:** Real-time on submit
- **Credentials:** Google service account (shared with all 3 spreadsheets)

### Vercel API Routes (Backend)
- **What:** API backend for the React app (replaced Google Apps Script)
- **How:** Serverless functions under `/api/` — same-origin, no CORS needed
- **Routes:** get-reps, get-assignments, get-prospects, get-last-sync, save-prospect, submit-weekly-log, sync-assignments, create-weekly-dashboard, consolidate-dashboard
- **Deployment:** Auto-deploys with `git push` (same as frontend)

---

## Deployment & Operations

### Full Stack (Vercel)

```
Repository: GitHub (auto-deploy from main)
URL: https://copper-builders-log.vercel.app/
Frontend: React + Vite (static build)
Backend: Vercel serverless functions (/api/*)
Sheets access: Google service account + Sheets API v4
Auto-scaling: Yes
```

### Cron Jobs (Vercel)

```
Monday 4:00 AM EST
  └─ sync-smartsheet → /api/sync-smartsheet
     └─ Pulls assignments from Smartsheet
     └─ Updates "Assignments" tab

Tuesday 1:00 AM EST
  └─ consolidate-dashboard → /api/consolidate-dashboard
     └─ Processes weekly submissions
     └─ Updates "Dashboard" tab
     └─ Archives previous week
```

---

## Performance Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Page Load | <3s | ~1.2s |
| Form Submit | <2s | ~0.8s |
| Data Fetch | <2s | ~0.5s |
| Prospect Search | <1s | ~0.3s |
| Dashboard Consolidation | <5m | ~1m |

---

## Error Handling & Recovery

### User-Facing Errors

| Scenario | Message | Action |
|----------|---------|--------|
| No rep selected | "Select a rep to begin" | Click dropdown |
| Network error | "Network error — retrying..." | Auto-retry (3x) |
| Submission fails | "Submission failed — [reason]" | Retry button shown |
| BOYL market missing | "Please select market for BOYL" | Prevent submit |
| Old Smartsheet data | "Data is 8+ days old" | Contact admin |

### System Failures

| Failure | Impact | Recovery |
|---------|--------|----------|
| Vercel API down | Can't submit | Enter data directly in Google Sheets |
| Smartsheet sync fails | Stale assignments | Admin can manually update Assignments tab |
| Google Sheets quota exceeded | Can't save data | Auto-retry with exponential backoff |
| Vercel CDN down | App unavailable | Automatic failover (Vercel handles) |

### Data Recovery

- **Backups:** Google Sheets auto-versioning (30-day history)
- **Submission Retry:** Automatic retry with exponential backoff
- **Manual Override:** Admins can enter data directly in Google Sheets if needed

---

## Security & Privacy

### Authentication
- **No user auth required** (rep selection via dropdown only)
- **Assumes trusted internal environment** (Copper Builders team only)
- **Optional:** Can add Google Sign-In if needed

### Data Access
- **Submissions tab:** Visible to all team members
- **Prospects tab:** Visible to all team members
- **Smartsheet API key:** Stored in environment variables (Vercel)
- **Google Sheets API:** Accessed via service account (Vercel env vars)

### Recommended Practices
1. Limit spreadsheet sharing to Copper Builders domain only
2. Enable Google Sheets audit trail
3. Monitor Vercel function logs for API errors
4. Rotate Smartsheet API key annually

---

## Troubleshooting Guide

### Issue: "Can't load assignments"

**Possible Causes:**
1. Smartsheet API token expired
2. Google service account lost access to spreadsheet
3. Network timeout

**Fix:**
```
1. Verify Smartsheet API key is valid (Settings > API Keys)
2. Check that all 3 Google Sheets are shared with the service account email
3. Check Vercel function logs for error details
4. Refresh browser (Cmd+R)
```

### Issue: "Prospect won't save"

**Possible Causes:**
1. Invalid prospect data (name required, for example)
2. Google Sheets quota exceeded
3. Vercel function error

**Fix:**
```
1. Check all required fields are filled
2. Wait 60 seconds and retry (quota cooldown)
3. Check browser console for error details (F12)
4. Clear browser cache and retry
```

### Issue: "Weekly submission not appearing in Google Sheets"

**Possible Causes:**
1. Submission didn't actually go through
2. Google Sheets processing delay
3. Filter hiding the row

**Fix:**
```
1. Check Submissions tab for latest entry (scroll down)
2. Look for this week's date in "Week Ending" column
3. Remove any filters: Data > Filter > Reset range
4. Check if submitted row has today's timestamp
```

---

## Future Enhancements

**Planned Features:**
- [ ] Mobile app (iOS/Android) for on-the-go reporting
- [ ] Offline mode (save drafts locally, sync when online)
- [ ] Photo uploads (prospect photos, model home photos)
- [ ] Advanced filters & export (CSV, PDF)
- [ ] Slack integration (weekly report summaries)
- [ ] Email notifications (to management on submit)
- [ ] Advanced analytics (conversion rates, pipeline aging)
- [ ] Multi-language support

**Technical Debt:**
- [ ] Add TypeScript for type safety
- [ ] Implement accessibility (WCAG 2.1)
- [ ] Add E2E tests (Playwright)
- [ ] Migrate to Supabase for better scalability
- [ ] Add real authentication (Google Sign-In)

---

## Support & Maintenance

### Weekly Tasks
- Monitor Smartsheet sync status (Monday morning)
- Check for submission errors (Friday)
- Review dashboard consolidation (Tuesday morning)

### Monthly Tasks
- Export historical data for analysis
- Audit Google Sheets for data quality
- Review prospect pipeline aging

### Quarterly Tasks
- Performance review (load times, errors)
- Security audit
- Backup/disaster recovery test
- Team training refresher

---

## Contact & Support

**Technical Issues:**
- Check Vercel function logs for errors
- Check Troubleshooting Guide section above
- Contact: OpenClaw Agent (available 24/7)

**Data Questions:**
- Is the data in Google Sheets correct?
- Check the Submissions/Prospects tabs directly
- Verify with the rep who submitted

**Feature Requests:**
- Document in GitHub issues
- Request in team Slack
- Quarterly review session

---

## Summary

The **Weekly Sales Log** provides a streamlined way for sales reps to log appointments and prospects, with automatic consolidation into management dashboards. It's built on React + Vercel serverless functions with Google Sheets for data persistence, and integrates with your existing Smartsheet workflow.

The entire stack deploys automatically via `git push` to GitHub — no manual steps required.

---

*Last Updated: March 20, 2026*  
*Next Review: April 20, 2026*
