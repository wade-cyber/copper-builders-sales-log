// POST /api/monday-night — Monday 10:30 AM ET orchestrator
// Phase 1: Submission status report (logged to run_log)
// Phase 2: Import OSC leads + rotate OSC sheet

import {
  getSheetData, updateRange, getSheetId, batchUpdate,
  getWeekEndingSunday, formatTabName,
  TEMPLATE_SHEET_ID,
} from './_lib/sheets.js';
import { getCommunitiesFromAssignmentsSheet, getRepsFromAssignmentsSheet } from './_lib/sync-from-assignments-sheet.js';
import { supabase } from './_lib/db.js';
import { importOSCLeads } from './_lib/import-osc-leads.js';

export default async function handler(req, res) {
  let body = {};
  if (req.method === 'POST' && req.body) {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  const phase = body.phase || 1;
  const targetDate = body.targetDate || null;

  try {
    if (phase === 1) {
      const result = await runPhase1();
      // Chain to phase 2
      const baseUrl = `https://${req.headers.host}`;
      fetch(`${baseUrl}/api/monday-night`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 2, targetDate }),
      }).catch((error) => {
        console.error('[PHASE 2 TRIGGER FAILURE]', error.message);
      });
      return res.status(200).json({ phase: 1, ...result });
    }

    if (phase === 2) {
      const result = await runPhase2(targetDate);
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
// PHASE 1: Submission status report
// ═══════════════════════════════════════════════════════════

async function runPhase1() {
  const weekEnding = getWeekEndingSunday().toISOString().slice(0, 10);
  const reps = await getRepsFromAssignmentsSheet();

  // Check who submitted this week from Supabase
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

async function runPhase2(targetDate = null) {
  // Step 2a: Import OSC leads from Google Sheet into database
  let oscImportResult = { success: false, message: 'skipped' };
  try {
    const result = await importOSCLeads();
    oscImportResult = { success: true, imported: result.imported, errors: result.errors.length };
  } catch (e) {
    console.error('[Phase 2] OSC lead import failed:', e.message);
    oscImportResult = { success: false, message: e.message };
  }

  // Step 2b: Rotate OSC leads sheet (archive current, prep next week)
  let oscRotateResult = { success: false, message: 'skipped' };
  try {
    oscRotateResult = await rotateOSCLeadsSheet(targetDate);
  } catch (e) {
    console.error('[Phase 2] OSC rotate failed:', e.message);
    oscRotateResult = { success: false, message: e.message };
  }

  await logRun('monday-night-phase2',
    (oscImportResult.success && oscRotateResult.success) ? 'success' : 'partial',
    `OSC import: ${oscImportResult.success ? oscImportResult.imported + ' leads' : 'FAILED: ' + oscImportResult.message}. OSC rotate: ${oscRotateResult.success || 'FAILED: ' + oscRotateResult.message}.`);

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
  const TOTAL_COLS = 39; // A through AM
  const DATA_START_COL = 6; // column G (0-based index 6)
  const DATA_COL_COUNT = TOTAL_COLS - DATA_START_COL; // G through AM = 33 cols

  // Calculate dates
  const currentSunday = getWeekEndingSunday(targetDate);
  const previousSunday = new Date(currentSunday);
  previousSunday.setDate(currentSunday.getDate() - 7);
  const archiveName = formatTabName(previousSunday);
  const weekEndingDate = `${currentSunday.getMonth() + 1}/${currentSunday.getDate()}/${String(currentSunday.getFullYear()).slice(2)}`;

  const templateSheetId = await getSheetId(OSC_SHEET, TEMPLATE_TAB);
  if (templateSheetId === null) {
    return { success: false, message: 'Dashboard Template tab not found' };
  }

  // Step 1: Archive existing "This Week's Report" → rename to "Week of [date]"
  let archiveSkipped = false;
  const existingReport = await getSheetId(OSC_SHEET, REPORT_TAB);
  if (existingReport !== null) {
    const existingArchive = await getSheetId(OSC_SHEET, archiveName);
    if (existingArchive !== null) {
      console.log(`Archive '${archiveName}' already exists, deleting stale report tab`);
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

  // Step 2: Create fresh "This Week's Report" by duplicating Dashboard Template
  await batchUpdate(OSC_SHEET, [{
    duplicateSheet: {
      sourceSheetId: templateSheetId,
      newSheetName: REPORT_TAB,
    }
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

  // Step 5: Sync dynamic communities (rows 13+) from database
  const newCommunities = await getCommunitiesFromAssignmentsSheet();
  let communitiesUpdated = 0;

  if (newCommunities.length > 0) {
    const nameRows = newCommunities.map(c => [c.name, c.market]);
    await updateRange(OSC_SHEET,
      `'${REPORT_TAB}'!A13:B${12 + newCommunities.length}`,
      nameRows
    );
    communitiesUpdated = newCommunities.length;

    if (lastRow > 12 + newCommunities.length) {
      const extraRows = lastRow - (12 + newCommunities.length);
      const blankRows = Array.from({ length: extraRows }, () => ['', '']);
      await updateRange(OSC_SHEET,
        `'${REPORT_TAB}'!A${13 + newCommunities.length}:B${lastRow}`,
        blankRows
      );
    }
  }

  return {
    success: true,
    archived: archiveSkipped ? `${archiveName} (skipped)` : archiveName,
    archiveSkipped,
    reportTab: REPORT_TAB,
    weekEndingDate,
    communitiesUpdated,
    communitiesChanged: communitiesUpdated > 0,
  };
}

// ═══════════════════════════════════════════════════════════
// LOGGING — write to Supabase run_log
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
