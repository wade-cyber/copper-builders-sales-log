// POST /api/monday-night — Monday 10:30 AM ET orchestrator
// Phase 1: Submission status report (logged to run_log)
// Phase 2: Import OSC leads + rotate OSC sheet

import {
  getSheetData, updateRange, getSheetId, batchUpdate,
  getWeekEndingSunday, formatTabName,
  TEMPLATE_SHEET_ID,
} from './_lib/sheets.js';
import { getActiveCommunities, getAssignedReps } from './_lib/assignments-queries.js';
import { supabase } from './_lib/db.js';
import { importOSCLeads } from './_lib/import-osc-leads.js';
import { withRetry } from './_lib/retry.js';

export default async function handler(req, res) {

  let body = {};
  if (req.method === 'POST' && req.body) {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  const phase = body.phase || 1;
  const targetDate = body.targetDate || null;
  const force = body.force || false;

  try {
    if (phase === 1) {
      const result = await runPhase1(force);
      if (result.already_processed) {
        return res.status(200).json({ phase: 1, ...result });
      }
      // Chain to phase 2 — await it so failures are caught
      try {
        const baseUrl = `https://${req.headers.host}`;
        const p2Res = await fetch(`${baseUrl}/api/monday-night`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.API_SECRET,
          },
          body: JSON.stringify({ phase: 2, targetDate, force }),
        });
        if (!p2Res.ok) {
          const text = await p2Res.text().catch(() => '');
          console.error('[Phase 2 chain] HTTP', p2Res.status, text);
          await logRun('monday-night-phase2', 'error', `Phase 2 chain returned HTTP ${p2Res.status}`);
        }
      } catch (error) {
        console.error('[PHASE 2 TRIGGER FAILURE]', error.message);
        await logRun('monday-night-phase2', 'error', `Phase 2 trigger failed: ${error.message}`);
      }
      return res.status(200).json({ phase: 1, ...result });
    }

    if (phase === 2) {
      const result = await runPhase2(targetDate, force);
      return res.status(200).json({ phase: 2, ...result });
    }

    return res.status(400).json({ error: 'Invalid phase' });
  } catch (err) {
    console.error(err);
    await logRun('monday-night', 'error', `Phase ${phase} failed: ${err.message}`);
    return res.status(500).json({ error: `Phase ${phase} failed: ${err.message}` });
  }
}

// ═══════════════════════════════════════════════════════════
// IDEMPOTENCY CHECK
// ═══════════════════════════════════════════════════════════

async function alreadyProcessed(runType) {
  const currentSunday = getWeekEndingSunday();
  const lastSunday = new Date(currentSunday);
  lastSunday.setDate(currentSunday.getDate() - 7);
  const since = lastSunday.toISOString().slice(0, 10);
  const { data } = await supabase
    .from('run_log')
    .select('id')
    .eq('run_type', runType)
    .eq('status', 'success')
    .gte('completed_at', since)
    .limit(1);
  return data && data.length > 0;
}

// ═══════════════════════════════════════════════════════════
// PHASE 1: Submission status report
// ═══════════════════════════════════════════════════════════

async function runPhase1(force = false) {
  if (!force && await alreadyProcessed('monday-night-phase1')) {
    return { success: true, already_processed: true, message: 'Phase 1 already ran this week. Pass force:true to rerun.' };
  }

  const weekEnding = getWeekEndingSunday().toISOString().slice(0, 10);

  // Carry forward assignments from last week to this week (if not already done)
  const carryResult = await carryForwardAssignments(weekEnding);
  console.log('[Phase 1] Assignment carry-forward:', JSON.stringify(carryResult));

  const reps = await getAssignedReps();

  const { data: submissions } = await supabase
    .from('weekly_submissions')
    .select('rep_id, submitted_at, reps(name)')
    .eq('week_ending', weekEnding);

  const submittedReps = {};
  for (const s of (submissions || [])) {
    submittedReps[s.reps.name] = s.submitted_at;
  }

  const submitted = Object.keys(submittedReps).length;

  await logRun('monday-night-phase1', 'success',
    `Report: ${reps.length} reps expected, ${submitted} submitted.`);

  return {
    success: true,
    repsExpected: reps.length,
    repsSubmitted: submitted,
  };
}

// ═══════════════════════════════════════════════════════════
// PHASE 2: Import OSC leads + rotate OSC sheet
// ═══════════════════════════════════════════════════════════

async function runPhase2(targetDate = null, force = false) {
  if (!force && await alreadyProcessed('monday-night-phase2')) {
    return { success: true, already_processed: true, message: 'Phase 2 already ran this week. Pass force:true to rerun.' };
  }

  // Step 2a: Import OSC leads from Google Sheet into database
  let oscImportResult = { success: false, message: 'skipped' };
  try {
    const result = await importOSCLeads();
    oscImportResult = { success: true, imported: result.imported, errors: result.errors.length, sourceTab: result.sourceTab };
  } catch (e) {
    console.error('[Phase 2] OSC lead import failed:', e.message);
    oscImportResult = { success: false, message: e.message };
  }

  // Step 2b: Rotate OSC leads sheet (archive current, prep next week) — with retries
  let oscRotateResult = { success: false, message: 'skipped' };
  try {
    oscRotateResult = await withRetry(() => rotateOSCLeadsSheet(targetDate), 2, 2000);
  } catch (e) {
    console.error('[Phase 2] OSC rotate failed after retries:', e.message);
    oscRotateResult = { success: false, message: e.message };
  }

  // Step 2c: Trigger CB Dashboard refresh so sales data appears on the weekly dashboard
  try {
    const dashboardUrl = process.env.CB_DASHBOARD_URL || 'https://cb-weekly-dashboard-rllnf3ukva-uc.a.run.app';
    const prefetchToken = process.env.CB_DASHBOARD_PREFETCH_TOKEN || '';
    if (prefetchToken) {
      await fetch(`${dashboardUrl}/api/prefetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-prefetch-token': prefetchToken },
        body: JSON.stringify({ source: 'sales-log-cron' }),
      });
      console.log('[Phase 2] CB Dashboard prefetch triggered');
    }
  } catch (e) {
    console.error('[Phase 2] CB Dashboard prefetch failed:', e.message);
  }

  const oscOk = oscImportResult.success && oscImportResult.imported > 0;
  const allSuccess = oscOk && oscRotateResult.success;
  const oscSummary = oscImportResult.success
    ? (oscImportResult.imported > 0
        ? `${oscImportResult.imported} leads from "${oscImportResult.sourceTab}"`
        : 'ran but 0 leads found — sheet may be empty')
    : `FAILED: ${oscImportResult.message}`;
  await logRun('monday-night-phase2',
    allSuccess ? 'success' : 'partial',
    `OSC import: ${oscSummary}. OSC rotate: ${oscRotateResult.success || 'FAILED: ' + oscRotateResult.message}.`);

  return {
    success: true,
    oscImport: oscImportResult,
    oscRotation: oscRotateResult,
  };
}

// ═══════════════════════════════════════════════════════════
// ROTATE OSC LEADS SHEET
// ═══════════════════════════════════════════════════════════

async function rotateOSCLeadsSheet(targetDate = null) {
  const OSC_SHEET = TEMPLATE_SHEET_ID;
  const TEMPLATE_TAB = 'Dashboard Template';
  const REPORT_TAB = "This Week's Report";
  const TOTAL_COLS = 39;
  const DATA_START_COL = 6;
  const DATA_COL_COUNT = TOTAL_COLS - DATA_START_COL;

  const currentSunday = getWeekEndingSunday(targetDate);
  const previousSunday = new Date(currentSunday);
  previousSunday.setDate(currentSunday.getDate() - 7);
  const archiveName = formatTabName(previousSunday);
  const weekEndingDate = `${currentSunday.getMonth() + 1}/${currentSunday.getDate()}/${String(currentSunday.getFullYear()).slice(2)}`;

  const templateSheetId = await getSheetId(OSC_SHEET, TEMPLATE_TAB);
  if (templateSheetId === null) {
    return { success: false, message: 'Dashboard Template tab not found' };
  }

  // Step 1: Archive existing "This Week's Report"
  let archiveSkipped = false;
  const existingReport = await getSheetId(OSC_SHEET, REPORT_TAB);
  if (existingReport !== null) {
    const existingArchive = await getSheetId(OSC_SHEET, archiveName);
    if (existingArchive !== null) {
      try {
        await batchUpdate(OSC_SHEET, [{ deleteSheet: { sheetId: existingReport } }]);
      } catch (e) {
        console.error('[OSC Rotate] Delete stale report failed:', e.message);
      }
      archiveSkipped = true;
    } else {
      try {
        await batchUpdate(OSC_SHEET, [{
          updateSheetProperties: {
            properties: { sheetId: existingReport, title: archiveName },
            fields: 'title',
          }
        }]);
      } catch (e) {
        console.error('[OSC Rotate] Archive rename failed:', e.message);
        archiveSkipped = true;
      }
    }
  } else {
    archiveSkipped = true;
  }

  // Step 2: Create fresh tab from template
  await batchUpdate(OSC_SHEET, [{
    duplicateSheet: { sourceSheetId: templateSheetId, newSheetName: REPORT_TAB }
  }]);

  // Step 3: Clear data columns G:AM for rows 7+
  const allData = await getSheetData(OSC_SHEET, `'${REPORT_TAB}'!A1:A`);
  const lastRow = allData.length;

  if (lastRow >= 7) {
    const clearRowCount = lastRow - 7 + 1;
    const blankRow = Array(DATA_COL_COUNT).fill('');
    const blanks = Array.from({ length: clearRowCount }, () => [...blankRow]);
    await updateRange(OSC_SHEET, `'${REPORT_TAB}'!G7:AM${lastRow}`, blanks);
  }

  // Step 4: Update week ending date
  await updateRange(OSC_SHEET, `'${REPORT_TAB}'!B2`, [[weekEndingDate]]);

  // Step 5: Sync communities from database
  const newCommunities = await getActiveCommunities();
  let communitiesUpdated = 0;

  if (newCommunities.length > 0) {
    const nameRows = newCommunities.map(c => [c.name, c.market]);
    await updateRange(OSC_SHEET, `'${REPORT_TAB}'!A13:B${12 + newCommunities.length}`, nameRows);
    communitiesUpdated = newCommunities.length;

    if (lastRow > 12 + newCommunities.length) {
      const extraRows = lastRow - (12 + newCommunities.length);
      const blankRows = Array.from({ length: extraRows }, () => ['', '']);
      await updateRange(OSC_SHEET, `'${REPORT_TAB}'!A${13 + newCommunities.length}:B${lastRow}`, blankRows);
    }
  }

  return {
    success: true,
    archived: archiveSkipped ? `${archiveName} (skipped)` : archiveName,
    archiveSkipped,
    reportTab: REPORT_TAB,
    weekEndingDate,
    communitiesUpdated,
  };
}

// ═══════════════════════════════════════════════════════════
// CARRY FORWARD ASSIGNMENTS
// ═══════════════════════════════════════════════════════════

async function carryForwardAssignments(weekEnding) {
  // If this week already has assignments, nothing to do
  const { data: existing } = await supabase
    .from('assignments')
    .select('id')
    .eq('week_ending', weekEnding)
    .limit(1);
  if (existing && existing.length > 0) {
    return { skipped: true, reason: 'already exists' };
  }

  // Find the most recent prior week that has assignments
  const { data: recent } = await supabase
    .from('assignments')
    .select('week_ending')
    .not('week_ending', 'is', null)
    .lt('week_ending', weekEnding)
    .order('week_ending', { ascending: false })
    .limit(1);

  let sourceWeek = recent?.[0]?.week_ending || null;
  let sourceQuery;

  if (sourceWeek) {
    sourceQuery = supabase.from('assignments').select('rep_id, community_id').eq('week_ending', sourceWeek);
  } else {
    // No week-tagged assignments yet — fall back to legacy NULL-week rows
    sourceWeek = 'legacy';
    sourceQuery = supabase.from('assignments').select('rep_id, community_id').is('week_ending', null);
  }

  const { data: source } = await sourceQuery;
  if (!source || source.length === 0) {
    return { skipped: true, reason: 'no source assignments found' };
  }

  const newRows = source.map(a => ({
    rep_id: a.rep_id,
    community_id: a.community_id,
    week_ending: weekEnding,
    source: 'carried_forward',
  }));

  const { error } = await supabase
    .from('assignments')
    .upsert(newRows, { onConflict: 'rep_id,community_id,week_ending', ignoreDuplicates: true });

  if (error) throw error;
  return { carried: newRows.length, fromWeek: sourceWeek, toWeek: weekEnding };
}

// ═══════════════════════════════════════════════════════════
// LOGGING
// ═══════════════════════════════════════════════════════════

async function logRun(runType, status, summary) {
  try {
    await supabase.from('run_log').insert({
      run_type: runType,
      status,
      completed_at: new Date().toISOString(),
      records_processed: 0,
      summary,
    });
  } catch (e) {
    console.error('[logRun] Failed:', e.message);
  }
}
