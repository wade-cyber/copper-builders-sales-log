// POST /api/monday-night — Monday midnight orchestrator
// Sales rep reporting tool only — no leads sheet management.
// Phase 1: Submission status report
// Phase 2: Cache assignments + consolidate data + write weekly stats to Assignments sheet

import {
  getSheetData, updateRange, clearRange, getSheetId, batchUpdate,
  getCurrentWeekEndingShort, logToSystemLog, toNum,
  SALES_APP_SHEET_ID, ASSIGNMENTS_SHEET_ID,
} from './_lib/sheets.js';
import { getCommunitiesFromAssignmentsSheet, getRepsFromAssignmentsSheet } from './_lib/sync-from-assignments-sheet.js';

export default async function handler(req, res) {
  let body = {};
  if (req.method === 'POST' && req.body) {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  const phase = body.phase || 1;

  try {
    if (phase === 1) {
      const result = await runPhase1();
      // Chain to phase 2
      const baseUrl = `https://${req.headers.host}`;
      fetch(`${baseUrl}/api/monday-night`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 2 }),
      }).catch(() => {});
      return res.status(200).json({ phase: 1, ...result });
    }

    if (phase === 2) {
      const result = await runPhase2();
      return res.status(200).json({ phase: 2, ...result });
    }

    return res.status(400).json({ error: 'Invalid phase' });
  } catch (err) {
    console.error(err);
    await logToSystemLog('monday-night', 'error', `Phase ${phase} failed: ${err.message}`);
    return res.status(500).json({ error: `Phase ${phase} failed. Check system log for details.` });
  }
}

// ═══════════════════════════════════════════════════════════
// PHASE 1: Submission status report
// ═══════════════════════════════════════════════════════════

async function runPhase1() {
  const currentWeekEnding = getCurrentWeekEndingShort();
  const reps = await getRepsFromAssignmentsSheet();

  let submittedReps = {};
  try {
    const sData = await getSheetData(SALES_APP_SHEET_ID, 'Submissions');
    if (sData.length > 1) {
      const sH = sData[0];
      const sRepIdx = sH.indexOf('Rep Name');
      const sWeekIdx = sH.indexOf('Week Ending');
      const sTimestampIdx = sH.indexOf('Timestamp');

      for (let i = 1; i < sData.length; i++) {
        const weekVal = (sData[i][sWeekIdx] || '').toString().trim();
        if (currentWeekEnding && weekVal !== currentWeekEnding) continue;
        const repName = (sData[i][sRepIdx] || '').toString().trim();
        if (repName) submittedReps[repName] = (sData[i][sTimestampIdx] || '').toString();
      }
    }
  } catch {}

  // Write Sales Reports tab
  let reportSheetId = await getSheetId(SALES_APP_SHEET_ID, 'Sales Reports');
  if (reportSheetId === null) {
    await batchUpdate(SALES_APP_SHEET_ID, [{
      addSheet: { properties: { title: 'Sales Reports' } }
    }]);
  } else {
    try { await clearRange(SALES_APP_SHEET_ID, "'Sales Reports'!A1:Z100"); } catch {}
  }

  const reportRows = [
    ['Sales Reports — Week Ending ' + currentWeekEnding, '', ''],
    ['', '', ''],
    ['Rep Name', 'Sales Log', 'Submitted At'],
  ];
  for (const rep of reps) {
    reportRows.push([
      rep,
      submittedReps[rep] ? 'Submitted' : 'MISSING',
      submittedReps[rep] || '',
    ]);
  }
  reportRows.push(['', '', '']);
  reportRows.push([`Generated: ${new Date().toISOString()}`, '', '']);

  await updateRange(SALES_APP_SHEET_ID, `'Sales Reports'!A1:C${reportRows.length}`, reportRows);

  await logToSystemLog('monday-night-phase1', 'success',
    `Report: ${reps.length} reps, ${Object.keys(submittedReps).length} submitted.`);

  return {
    success: true,
    repsExpected: reps.length,
    repsSubmitted: Object.keys(submittedReps).length,
  };
}

// ═══════════════════════════════════════════════════════════
// PHASE 2: Cache assignments + consolidate + write stats
// ═══════════════════════════════════════════════════════════

async function runPhase2() {
  // Step 2a: Cache assignments locally for fast app loading
  let assignmentResult = { success: false, message: 'skipped' };
  try {
    assignmentResult = await cacheAssignmentsLocally();
  } catch (e) {
    assignmentResult = { success: false, message: e.message };
  }

  // Step 2b: Run consolidation (writes Sales Data Results tab)
  let consolidateResult = { success: false, message: 'skipped' };
  try {
    consolidateResult = await runConsolidation();
  } catch (e) {
    consolidateResult = { success: false, message: e.message };
  }

  // Step 2c: Write weekly stats to Assignments sheet (columns D-H)
  let statsResult = { success: false, message: 'skipped' };
  try {
    statsResult = await writeWeeklyStatsToAssignments();
  } catch (e) {
    statsResult = { success: false, message: e.message };
  }

  await logToSystemLog('monday-night-phase2', 'success',
    `Assignments: ${assignmentResult.count || 0}. Consolidation: ${consolidateResult.success}. Stats: ${statsResult.rowsUpdated || 0} rows.`);

  return {
    success: true,
    assignments: assignmentResult,
    consolidation: consolidateResult,
    weeklyStats: statsResult,
  };
}

// ═══════════════════════════════════════════════════════════
// WRITE WEEKLY STATS TO ASSIGNMENTS SHEET
// ═══════════════════════════════════════════════════════════

async function writeWeeklyStatsToAssignments() {
  const currentWeekEnding = getCurrentWeekEndingShort();

  const assignData = await getSheetData(ASSIGNMENTS_SHEET_ID, 'Assignments');
  if (assignData.length < 2) return { success: true, rowsUpdated: 0 };

  const aHeaders = assignData[0];
  const aRepIdx = aHeaders.indexOf('Rep Name');
  let aCommunityIdx = aHeaders.indexOf('Community Name');
  if (aCommunityIdx < 0) aCommunityIdx = aHeaders.indexOf('Community or House Name');

  // Read Submissions for this week (deduplicated)
  const subsByRepComm = {};
  try {
    const sData = await getSheetData(SALES_APP_SHEET_ID, 'Submissions');
    if (sData.length > 1) {
      const sH = sData[0];
      const sRepIdx = sH.indexOf('Rep Name');
      const sCommIdx = sH.indexOf('Community');
      const sWeekIdx = sH.indexOf('Week Ending');
      const sTsIdx = sH.indexOf('Timestamp');
      const sApptsIdx = sH.indexOf('Total Appts');
      const sDLDigIdx = sH.indexOf('Direct Leads Digital');
      const sDLPhIdx = sH.indexOf('Direct Leads Phone Call');
      const sSoldIdx = sH.indexOf('Sold Prospects');

      for (let i = 1; i < sData.length; i++) {
        const week = (sData[i][sWeekIdx] || '').toString().trim();
        if (currentWeekEnding && week !== currentWeekEnding) continue;

        const rep = (sData[i][sRepIdx] || '').toString().trim();
        const comm = (sData[i][sCommIdx] || '').toString().trim();
        const ts = (sData[i][sTsIdx] || '').toString();
        const key = `${rep}||${comm}`;

        if (!subsByRepComm[key] || ts > subsByRepComm[key].ts) {
          subsByRepComm[key] = {
            ts,
            appts: toNum(sData[i][sApptsIdx]),
            dlDigital: sDLDigIdx >= 0 ? toNum(sData[i][sDLDigIdx]) : 0,
            dlPhone: sDLPhIdx >= 0 ? toNum(sData[i][sDLPhIdx]) : 0,
            sold: sSoldIdx >= 0 ? toNum(sData[i][sSoldIdx]) : 0,
          };
        }
      }
    }
  } catch {}

  // Read Prospects for active counts per rep+community
  const prospectsByRepComm = {};
  try {
    const pData = await getSheetData(SALES_APP_SHEET_ID, 'Prospects');
    if (pData.length > 1) {
      const pH = pData[0];
      const pRepIdx = pH.indexOf('Rep Name');
      const pCommIdx = pH.indexOf('Community');
      const pStatusIdx = pH.indexOf('Status');

      for (let i = 1; i < pData.length; i++) {
        const status = (pData[i][pStatusIdx] || 'active').toString().toLowerCase();
        if (status !== 'active') continue;
        const rep = (pData[i][pRepIdx] || '').toString().trim();
        const comm = (pData[i][pCommIdx] || '').toString().trim();
        const key = `${rep}||${comm}`;
        prospectsByRepComm[key] = (prospectsByRepComm[key] || 0) + 1;
      }
    }
  } catch {}

  // Build values for columns D-H for each Assignments row
  const statsRows = [];
  let rowsUpdated = 0;

  for (let i = 1; i < assignData.length; i++) {
    const rep = (assignData[i][aRepIdx] || '').toString().trim();
    const comm = aCommunityIdx >= 0 ? (assignData[i][aCommunityIdx] || '').toString().trim() : '';
    const key = `${rep}||${comm}`;

    const sub = subsByRepComm[key];
    const prospects = prospectsByRepComm[key] || 0;

    if (sub) {
      const reportDate = sub.ts ? new Date(sub.ts).toLocaleDateString('en-US') : '';
      statsRows.push([reportDate, sub.sold || 0, prospects, sub.appts || 0, sub.dlDigital + sub.dlPhone]);
      rowsUpdated++;
    } else {
      statsRows.push(['', 0, prospects, 0, 0]);
    }
  }

  if (statsRows.length > 0) {
    await updateRange(ASSIGNMENTS_SHEET_ID, `Assignments!D2:H${1 + statsRows.length}`, statsRows);
  }

  return { success: true, rowsUpdated };
}

// ═══════════════════════════════════════════════════════════
// CACHE ASSIGNMENTS LOCALLY
// ═══════════════════════════════════════════════════════════

async function cacheAssignmentsLocally() {
  const data = await getSheetData(ASSIGNMENTS_SHEET_ID, 'Assignments');
  if (data.length < 2) return { success: true, count: 0 };

  const headers = data[0];
  const repIdx = headers.indexOf('Rep Name');
  let communityIdx = headers.indexOf('Community Name');
  if (communityIdx < 0) communityIdx = headers.indexOf('Community or House Name');
  const divisionIdx = headers.indexOf('Division');
  const thirdPartyIdx = headers.indexOf('3rd Party?');
  const reportToolIdx = headers.indexOf('Sales reporting tool report this week?');

  const rows = [];
  for (let i = 1; i < data.length; i++) {
    if (reportToolIdx >= 0) {
      const val = (data[i][reportToolIdx] || '').toString().trim().toLowerCase();
      if (val !== 'yes') continue;
    }
    const rep = (data[i][repIdx] || '').toString().trim();
    const comm = communityIdx >= 0 ? (data[i][communityIdx] || '').toString().trim() : '';
    if (!rep || !comm) continue;
    const division = divisionIdx >= 0 ? (data[i][divisionIdx] || '').toString().trim() : '';
    const tp = thirdPartyIdx >= 0 ? (data[i][thirdPartyIdx] || '').toString().trim().toLowerCase() : '';
    rows.push([rep, comm, division, tp]);
  }

  let sheetId = await getSheetId(SALES_APP_SHEET_ID, 'Weekly Assignments');
  if (sheetId === null) {
    await batchUpdate(SALES_APP_SHEET_ID, [{
      addSheet: { properties: { title: 'Weekly Assignments' } }
    }]);
  }

  try { await clearRange(SALES_APP_SHEET_ID, "'Weekly Assignments'!A1:D500"); } catch {}

  await updateRange(SALES_APP_SHEET_ID, "'Weekly Assignments'!A1:D1", [
    ['Rep Name', 'Community Name', 'Division', '3rd Party']
  ]);

  if (rows.length > 0) {
    await updateRange(SALES_APP_SHEET_ID, `'Weekly Assignments'!A2:D${1 + rows.length}`, rows);
  }

  await updateRange(SALES_APP_SHEET_ID, "'Weekly Assignments'!F1:G1", [
    ['Last Synced', new Date().toISOString()]
  ]);

  return { success: true, count: rows.length };
}

// ═══════════════════════════════════════════════════════════
// CONSOLIDATION — writes Sales Data Results to Sales App
// ═══════════════════════════════════════════════════════════

async function runConsolidation() {
  const currentWeekEnding = getCurrentWeekEndingShort();

  // Read prospect counts
  const prospectCounts = {};
  try {
    const pData = await getSheetData(SALES_APP_SHEET_ID, 'Prospects');
    if (pData.length > 1) {
      const pH = pData[0];
      const pCommunityIdx = pH.indexOf('Community');
      const pStatusIdx = pH.indexOf('Status');
      for (let i = 1; i < pData.length; i++) {
        const status = (pData[i][pStatusIdx] || 'active').toString().toLowerCase();
        if (status !== 'active') continue;
        const comm = (pData[i][pCommunityIdx] || '').toString().trim().toLowerCase();
        if (comm) prospectCounts[comm] = (prospectCounts[comm] || 0) + 1;
      }
    }
  } catch {}

  // Read appointment counts + direct leads + sold counts from Submissions (deduplicated)
  const apptCounts = {};
  const directLeadCounts = {};
  const soldCounts = {};
  try {
    const sData = await getSheetData(SALES_APP_SHEET_ID, 'Submissions');
    if (sData.length > 1) {
      const sH = sData[0];
      const sCommunityIdx = sH.indexOf('Community');
      const sApptsIdx = sH.indexOf('Total Appts');
      const sWeekIdx = sH.indexOf('Week Ending');
      const sRepIdx = sH.indexOf('Rep Name');
      const sTimestampIdx = sH.indexOf('Timestamp');
      const sDigitalIdx = sH.indexOf('Direct Leads Digital');
      const sPhoneIdx = sH.indexOf('Direct Leads Phone Call');
      const sSoldIdx = sH.indexOf('Sold Prospects');

      if (sCommunityIdx >= 0 && sApptsIdx >= 0) {
        const latestByKey = {};
        for (let i = 1; i < sData.length; i++) {
          const weekVal = (sData[i][sWeekIdx] || '').toString().trim();
          if (currentWeekEnding && weekVal !== currentWeekEnding) continue;
          const rep = sRepIdx >= 0 ? (sData[i][sRepIdx] || '').toString().trim() : '';
          const comm = (sData[i][sCommunityIdx] || '').toString().trim();
          const ts = sTimestampIdx >= 0 ? (sData[i][sTimestampIdx] || '').toString() : '';
          const key = `${rep}||${comm}`;
          if (!latestByKey[key] || ts > latestByKey[key].ts) {
            latestByKey[key] = {
              ts, community: comm,
              appts: toNum(sData[i][sApptsIdx]),
              digital: sDigitalIdx >= 0 ? toNum(sData[i][sDigitalIdx]) : 0,
              phoneCall: sPhoneIdx >= 0 ? toNum(sData[i][sPhoneIdx]) : 0,
              sold: sSoldIdx >= 0 ? toNum(sData[i][sSoldIdx]) : 0,
            };
          }
        }
        for (const entry of Object.values(latestByKey)) {
          const key = entry.community.toLowerCase();
          apptCounts[key] = (apptCounts[key] || 0) + entry.appts;
          soldCounts[key] = (soldCounts[key] || 0) + entry.sold;
          if (!directLeadCounts[key]) directLeadCounts[key] = { digital: 0, phoneCall: 0 };
          directLeadCounts[key].digital += entry.digital;
          directLeadCounts[key].phoneCall += entry.phoneCall;
        }
      }
    }
  } catch {}

  // Build Sales Data Results from all communities
  const communities = await getCommunitiesFromAssignmentsSheet();
  const allRows = communities.map(c => [c.name, c.market]);

  let resultsSheetId = await getSheetId(SALES_APP_SHEET_ID, 'Sales Data Results');
  if (resultsSheetId === null) {
    await batchUpdate(SALES_APP_SHEET_ID, [{
      addSheet: { properties: { title: 'Sales Data Results' } }
    }]);
  }

  try { await clearRange(SALES_APP_SHEET_ID, "'Sales Data Results'!A1:K200"); } catch {}

  const headerRow = [
    'Community', 'Division', 'Sales', 'Active Prospects', 'Appointments Held',
    'Rep Direct Digital', 'Rep Direct Phone Call', 'Total Rep Leads',
  ];

  const dataRows = allRows.map(([name, market]) => {
    const key = name.toLowerCase();
    const prospects = prospectCounts[key] || 0;
    const appts = apptCounts[key] || 0;
    const sales = soldCounts[key] || 0;
    const dl = directLeadCounts[key] || { digital: 0, phoneCall: 0 };

    return [name, market, sales, prospects, appts, dl.digital, dl.phoneCall, dl.digital + dl.phoneCall];
  });

  await updateRange(SALES_APP_SHEET_ID, `'Sales Data Results'!A1:H1`, [headerRow]);
  if (dataRows.length > 0) {
    await updateRange(SALES_APP_SHEET_ID, `'Sales Data Results'!A2:H${1 + dataRows.length}`, dataRows);
  }

  return { success: true, rowsWritten: dataRows.length };
}
// force rebuild 1774478375
