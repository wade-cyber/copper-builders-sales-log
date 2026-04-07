# Copper Builders Sales Tool — Repair Plan

Prioritized repair plan based on a comprehensive code audit (April 5, 2026), updated after verifying the current codebase state. The migration from Google Sheets to Supabase is complete. The Google Apps Script backend has been removed. All user-facing reads/writes go through Vercel serverless functions backed by Supabase PostgreSQL. The only remaining Google Sheets dependency is the weekly OSC Leads import.

Items already completed are marked with ~~strikethrough~~. Work through the remaining items in order.

---

## What's Already Been Fixed

These items from the original audit have been verified as resolved:

- ~~**JWT token in .env.local**~~ — Token removed, file only contains a comment. .gitignore properly covers it.
- ~~**API authentication**~~ — `api/_lib/auth.js` exists. 11 of 12 endpoints use `requireAuth(req)`. Cron uses `requireCronAuth(req)`. (One gap remains — see 1.1 below.)
- ~~**Hardcoded year in parseWeekEnding**~~ — `api/submit-weekly-log.js` now uses `new Date().getFullYear()` with proper year-boundary handling for Dec/Jan.
- ~~**.env.example out of sync**~~ — Now contains 8 correct variables: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, TEMPLATE_SHEET_ID, SUPABASE_URL, SUPABASE_SERVICE_KEY, API_SECRET, VITE_API_SECRET, CRON_SECRET. All obsolete vars removed.
- ~~**Debouncing on prospect saves**~~ — `useProspects.js` implements 500ms debounce via `debounceTimers.current` on `updateProspect()`.
- ~~**Unsaved changes warning**~~ — `App.jsx` has a `beforeunload` listener that warns when appointments, directLeads, or openedBlocks are dirty and not yet submitted.
- ~~**Error display for most API failures**~~ — Rep fetch, assignment fetch, prospect fetch, prospect save, and submission errors all display messages in the UI. Offline detection is implemented via `navigator.onLine`.
- ~~**Apps Script backend removed**~~ — `apps-script/` directory deleted. No `google-apps-script.js` in project. No `VITE_GOOGLE_SCRIPT_URL` references in frontend.
- ~~**Backfill files removed**~~ — `api/backfill-db.js` and `db/backfill.js` both deleted.
- ~~**AppointmentGrid dead code removed**~~ — Component deleted, zero references remain.
- ~~**NEXT_STEPS / constants.js removed**~~ — File deleted, zero references remain.
- ~~**fetchAllCommunities removed**~~ — Function deleted, zero references remain.
- ~~**pg dependency removed**~~ — Not in package.json, no imports found.
- ~~**Misleading function names fixed**~~ — File renamed to `assignments-queries.js` with functions `getActiveCommunities()` and `getAssignedReps()`.
- ~~**Google Sheets auth caching**~~ — `sheets.js` caches the GoogleAuth instance at module level. Token refresh handled by the library.

---

## Remaining Work

### Phase 1: Security

#### 1.1 Add Auth to health.js Endpoint
- **File**: `api/health.js`
- **Issue**: The only endpoint without authentication. Returns database stats, table counts, error counts, and last run timestamp — operational data that shouldn't be public.
- **Fix**: Add `requireAuth(req)` at the top of the handler, same as all other endpoints. Import from `api/_lib/auth.js`.

#### 1.2 Add Rate Limiting
- **File**: Create `middleware.js` in project root (Vercel Edge Middleware)
- **Issue**: No rate limiting on any endpoint. All APIs can be called at unlimited volume.
- **Fix**: Add a simple in-memory rate limiter (token bucket) that limits each IP to 60 requests/minute on `/api/*` routes. Use Vercel Edge Middleware format.

---

### Phase 2: Data Integrity

#### 2.1 Add Idempotency to Monday Night Cron
- **File**: `api/monday-night.js`
- **Issue**: No check for whether the current week was already processed. Re-running the cron (manual trigger, retry, Vercel duplicate execution) will import duplicate leads and corrupt the OSC sheet.
- **Fix**: At the start of each phase, query `run_log` in Supabase for an existing completed record with `run_type = 'monday-night'` and the current `week_ending`. If found, return `{ status: "already_processed" }`. Log the skip.

#### 2.2 Add Retry Logic to Monday Night Phase 2 (Sheets API)
- **File**: `api/monday-night.js` — `rotateOSCLeadsSheet()` and `importOSCLeads()` calls
- **Issue**: Phase 2 is fire-and-forget. Lines 30-36 trigger Phase 2 with a bare `fetch().catch()` that only logs to console. Google Sheets API calls (`getSheetId`, `batchUpdate`, `getSheetData`, `updateRange`) on lines 138-213 have no retry wrapper. A 429 or 500 from Google silently kills the job.
- **Fix**:
  1. Wrap all Sheets API calls in the existing `withRetry()` from `api/_lib/retry.js`.
  2. Replace the fire-and-forget Phase 2 fetch with an awaited call so failures are caught, logged to `run_log` / `error_log`, and the cron response reflects the outcome.

#### 2.3 Fix useProspects Race Condition in retrySave
- **File**: `src/hooks/useProspects.js` — lines 47-56
- **Issue**: `retrySave` captures `rep` from a closure dependency. If the user switches reps between the error and clicking retry, the save goes to the wrong rep. Current code: `saveProspect({ ...prospect, rep })` where `rep` is from the `useCallback` dependency array.
- **Fix**: When storing a failed save error (in `handleSaveError`), also store the `rep` value at that time. In `retrySave`, read the stored rep from the error context instead of using `rep` from current state.

#### 2.4 Add Optimistic Update Rollback
- **File**: `src/hooks/useProspects.js`
- **Issue**: Five save paths (retrySave, addProspect, debouncedSave, removeProspect, markSold) update the UI optimistically but never roll back on API failure. For example, `removeProspect` sets `status: 'removed'` immediately — if the API call fails, the prospect stays "removed" in the UI but is still active in the database.
- **Fix**: Before each optimistic update, snapshot the current prospects state. If the API `.catch()` fires, call `setProspects(snapshot)` to restore. Show a persistent error notification that the action failed.

---

### Phase 3: Reliability

#### 3.1 Fix Remaining Silent Failures (2 items)
Two error paths are still silently swallowed:

1. **Last sync fetch** — `src/hooks/useAssignments.js`, the `fetch('/api/get-last-sync')` call has `.catch(() => {})` which silently ignores errors. If the sync timestamp can't be loaded, the stale-data warning never appears. Fix: Set an error state or default to "unknown" so the UI can indicate that freshness is unknown.

2. **Unhandled promise rejections** — `src/components/ErrorBoundary.jsx` only catches render errors via `getDerivedStateFromError`. Async errors from failed Promises that aren't caught anywhere will silently disappear. Fix: Add `window.addEventListener('unhandledrejection', handler)` in `App.jsx` (in a useEffect) to catch and display uncaught Promise rejections.

#### 3.2 Fix Cron Timing (DST Issue)
- **File**: `vercel.json`
- **Issue**: Cron is `"30 14 * * 1"` (14:30 UTC Monday). During EDT (Apr–Oct), this is 10:30 AM ET. During EST (Nov–Mar), this is 9:30 AM ET. Both are during business hours, not "Monday night."
- **Fix**: Change to `"30 2 * * 2"` (02:30 UTC Tuesday). This maps to 10:30 PM ET (EDT) or 9:30 PM ET (EST) — always late Monday night regardless of DST.

#### 3.3 Fix Frontend Retry Strategy
- **File**: `src/utils/api.js` — `fetchWithRetry()`
- **Issue**: Both 4xx and 5xx errors throw and enter the retry loop. The 4xx branch (lines 12-14) throws `"Request failed (${res.status})"`, which gets caught by the same catch block that retries. A 400 Bad Request or 401 Unauthorized will be retried 3 times with exponential backoff, wasting time on errors that will never succeed.
- **Fix**: In the 4xx branch, throw immediately without entering the retry loop. Only let 5xx and network errors (TypeError from fetch) go through the retry path.

---

### Phase 4: Cleanup

#### 4.1 Smartsheet Column References
- **File**: `api/_lib/resolve-names.js`
- **Issue**: The `communities` table still has `smartsheet_name` and `sheets_name` columns, and `resolve-names.js` queries them for legacy name resolution. This isn't broken, but it's dead weight — no Smartsheet or Sheets-based assignments exist anymore.
- **Action**: Low priority. If you want to clean it up: remove the `smartsheet_name` and `sheets_name` columns from the `communities` table schema, update the select query in `resolveCommunity()` to only use `name`, and run a migration. Otherwise, leave as-is — it's harmless.

#### 4.2 Check Vite Version Compatibility
- **File**: `package.json`
- **Issue**: `vite@8.0.0` with `@vitejs/plugin-react@6.0.0`. These should be compatible but verify by checking the plugin's changelog.
- **Action**: Run `npm ls @vitejs/plugin-react` and check for peer dependency warnings. If clean, no action needed.

---

### Phase 5: Performance & Accessibility

#### 5.1 Move Inline Styles to CSS
- **Files**: `src/components/ProspectCard.jsx` (7 inline style objects), `src/components/SubmitScreen.jsx` (23 inline style objects)
- **Issue**: `style={{...}}` objects are created on every render. SubmitScreen is especially heavy with 23 instances.
- **Fix**: Move all inline styles to CSS classes in `src/index.css`. Replace `style={{...}}` with `className="..."`.

#### 5.2 Add Accessibility Improvements
- **Files**: All components in `src/components/`
- **Issue**: Zero `htmlFor` attributes, zero `aria-label` attributes, zero `onKeyDown` handlers found across the entire component tree. The app uses semantic HTML (labels, inputs, selects) but has no enhanced accessibility.
- **Fix**:
  - Add `htmlFor` attributes to all `<label>` elements and matching `id` to their inputs
  - Add `aria-label` to icon-only buttons and interactive elements without visible text
  - Add text alongside color-coded ranking pills (A/B/C) so colorblind users can distinguish them
  - Add `aria-hidden="true"` to decorative SVGs/icons
  - Add `onKeyDown` handlers for Enter/Space on any clickable `<div>` elements (CommunityBlock toggles)

#### 5.3 Consolidate State with useReducer
- **File**: `src/App.jsx`
- **Issue**: 12 individual `useState` calls: selectedRep, submitted, submitting, submitError, appointments, directLeads, openedBlocks, collapseKey, reps, repsError, offline.
- **Fix**: Group related state into a useReducer. At minimum, group submission state (submitted, submitting, submitError) into one reducer with actions like `SUBMIT_START`, `SUBMIT_SUCCESS`, `SUBMIT_ERROR`.

---

## Verification Checklist

- [ ] **Phase 1**: Call `/api/health` without `x-api-key` header — should get 401. Hit any endpoint 70 times in 1 minute — should get rate limited.
- [ ] **Phase 2**: Run `monday-night` twice for the same week — second run should return `already_processed`. Trigger Phase 2 with Sheets API down — error should appear in `run_log`, not silently disappear. Switch reps between error and retry — save should go to the original rep. Remove a prospect while offline — UI should revert when the API fails.
- [ ] **Phase 3**: Load app with `/api/get-last-sync` returning 500 — UI should indicate sync status unknown. Create an unhandled Promise rejection — should display an error, not disappear. Verify vercel.json cron is `"30 2 * * 2"`. Make a request that returns 400 — should NOT retry.
- [ ] **Phase 4**: `grep -ri "smartsheet_name" api/` — decide if you want to clean up or leave.
- [ ] **Phase 5**: Tab through the entire form with keyboard only. Verify focus indicators visible on every interactive element. Check `htmlFor`/`id` pairs on all label+input combos.
