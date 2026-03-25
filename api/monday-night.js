// POST /api/monday-night — Monday midnight orchestrator
// Runs all weekly close-out steps in sequence.
// Split into phases to handle Vercel timeout (10s hobby plan):
//   Phase 1: Submission report + copy rep leads to Dashboard Template
//   Phase 2: Archive week + prep next week + sync communities
//   Phase 3: Sync assignments to app + consolidate dashboard
//
// Cron trigger runs phase 1, which chains to phase 2, which chains to phase 3.

import {
  getSheetData, updateRange, clearRange, getSheetId, batchUpdate, getSpreadsheet,
  getCurrentWeekEndingShort, logToSystemLog, toNum, formatTabName,
  SALES_APP_SHEET_ID, LEADS_SHEET_ID,
} from './_lib/sheets.js';
import { syncFromAssignmentsSheet, getCommunitiesFromAssignmentsSheet, getRepsFromAssignmentsSheet } from './_lib/sync-from-assignments-sheet.js';
import { createWeeklyDashboard } from './_lib/create-weekly-dashboard.js';

export default async function handler(req, res) {
  // Allow specifying which phase to run (default: 1 = full sequence)
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
      }).catch(() => {}); // fire and forget
      return res.status(200).json({ phase: 1, ...result });
    }

    if (phase === 2) {
      const result = await runPhase2();
      // Chain to phase 3
      const baseUrl = `https://${req.headers.host}`;
      fetch(`${baseUrl}/api/monday-night`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 3 }),
      }).catch(() => {});
      return res.status(200).json({ phase: 2, ...result });
    }

    if (phase === 3) {
      const result = await runPhase3();
      return res.status(200).json({ phase: 3, ...result });
    }

    return res.status(400).json({ error: 'Invalid phase' });
  } catch (err) {
    await logToSystemLog('monday-night', 'error', `Phase ${phase} failed: ${err.message}`);
    return res.status(500).json({ error: `Phase ${phase} failed: ${err.message}` });
  }
}

// ═══════════════════════════════════════════════════════════
// PHASE 1: Submission report + copy rep direct leads
// ═══════════════════════════════════════════════════════════

async function runPhase1() {
  const currentWeekEnding = getCurrentWeekEndingShort();

  // Step 1a: Build submission status report
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
  } catch { /* no submissions */ }

  // Write Sales Reports tab
  let reportSheetId = await getSheetId(SALES_APP_SHEET_ID, 'Sales Reports');
  if (reportSheetId === null) {
    await batchUpdate(SALES_APP_SHEET_ID, [{
      addSheet: { properties: { title: 'Sales Reports' } }
    }]);
    reportSheetId = await getSheetId(SALES_APP_SHEET_ID, 'Sales Reports');
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
  const now = new Date();
  reportRows.push(['', '', '']);
  reportRows.push([`Generated: ${now.toISOString()}`, '', '']);

  await updateRange(SALES_APP_SHEET_ID, `'Sales Reports'!A1:C${reportRows.length}`, reportRows);

  // Step 1b: Copy rep direct leads to Dashboard Template cols AM and AN
  let leadsWritten = 0;
  try {
    const sData = await getSheetData(SALES_APP_SHEET_ID, 'Submissions');
    if (sData.length > 1) {
      const sH = sData[0];
      const sCommunityIdx = sH.indexOf('Community');
      const sWeekIdx = sH.indexOf('Week Ending');
      const sRepIdx = sH.indexOf('Rep Name');
      const sTimestampIdx = sH.indexOf('Timestamp');
      const sDigitalIdx = sH.indexOf('Direct Leads Digital');
      const sPhoneIdx = sH.indexOf('Direct Leads Phone Call');

      if (sDigitalIdx >= 0 && sPhoneIdx >= 0) {
        // Deduplicate by (rep, community, week) — keep latest
        const latestByKey = {};
        for (let i = 1; i < sData.length; i++) {
          const weekVal = (sData[i][sWeekIdx] || '').toString().trim();
          if (currentWeekEnding && weekVal !== currentWeekEnding) continue;

          const rep = (sData[i][sRepIdx] || '').toString().trim();
          const comm = (sData[i][sCommunityIdx] || '').toString().trim();
          const ts = (sData[i][sTimestampIdx] || '').toString();
          const key = `${rep}||${comm}`;

          if (!latestByKey[key] || ts > latestByKey[key].ts) {
            latestByKey[key] = {
              ts,
              digital: toNum(sData[i][sDigitalIdx]),
              phoneCall: toNum(sData[i][sPhoneIdx]),
              community: comm,
            };
          }
        }

        // Aggregate by community
        const byCommunity = {};
        for (const entry of Object.values(latestByKey)) {
          const key = entry.community.toLowerCase();
          if (!byCommunity[key]) byCommunity[key] = { digital: 0, phoneCall: 0 };
          byCommunity[key].digital += entry.digital;
          byCommunity[key].phoneCall += entry.phoneCall;
        }

        // Read Dashboard Template to find community rows (17+)
        const dtData = await getSheetData(LEADS_SHEET_ID, "'Dashboard Template'!A7:A");
        if (dtData.length > 0) {
          const amValues = [];
          const anValues = [];
          for (let i = 0; i < dtData.length; i++) {
            const name = (dtData[i][0] || '').toString().trim().toLowerCase();
            const match = byCommunity[name];
            amValues.push([match ? match.digital : 0]);
            anValues.push([match ? match.phoneCall : 0]);
            if (match) leadsWritten++;
          }
          const endRow = 7 + dtData.length - 1;
          await updateRange(LEADS_SHEET_ID, `'Dashboard Template'!AM7:AM${endRow}`, amValues);
          await updateRange(LEADS_SHEET_ID, `'Dashboard Template'!AN7:AN${endRow}`, anValues);
        }
      }
    }
  } catch { /* no direct leads columns yet */ }

  await logToSystemLog('monday-night-phase1', 'success',
    `Report: ${reps.length} reps, ${Object.keys(submittedReps).length} submitted. ${leadsWritten} communities with direct leads.`);

  return {
    success: true,
    repsExpected: reps.length,
    repsSubmitted: Object.keys(submittedReps).length,
    leadsWritten,
  };
}

// ═══════════════════════════════════════════════════════════
// PHASE 2: Archive week + prep next week + sync communities
// ═══════════════════════════════════════════════════════════

async function runPhase2() {
  const dashResult = await createWeeklyDashboard();

  await logToSystemLog('monday-night-phase2', 'success', dashResult.message);

  return { success: true, dashboard: dashResult };
}

// ═══════════════════════════════════════════════════════════
// PHASE 3: Sync assignments + consolidate dashboard
// ═══════════════════════════════════════════════════════════

async function runPhase3() {
  // Step 3a: Sync assignments to Sales App for the rep app
  const syncResult = await syncFromAssignmentsSheet();

  // Step 3b: Run consolidation (writes Sales Data Results tab)
  let consolidateResult = { success: false, message: 'skipped' };
  try {
    consolidateResult = await runConsolidation();
  } catch (e) {
    consolidateResult = { success: false, message: e.message };
  }

  await logToSystemLog('monday-night-phase3', 'success',
    `Assignments: ${syncResult.count}. Consolidation: ${consolidateResult.success}.`);

  return {
    success: true,
    assignments: syncResult,
    consolidation: consolidateResult,
  };
}

// ═══════════════════════════════════════════════════════════
// CONSOLIDATION — writes Sales Data Results to Sales App
// ═══════════════════════════════════════════════════════════

async function runConsolidation() {
  const currentWeekEnding = getCurrentWeekEndingShort();

  // Find the most recent archived week tab to read leads from
  const spreadsheetMeta = await getSpreadsheet(LEADS_SHEET_ID);
  const weekTabs = spreadsheetMeta.sheets
    .map(s => s.properties.title)
    .filter(t => t.startsWith('Week of'));
  const archivedTab = weekTabs.length > 0 ? weekTabs[0] : 'Dashboard Template';

  // Read lead data from archived tab
  let leadsData = [];
  try {
    leadsData = await getSheetData(LEADS_SHEET_ID, `'${archivedTab}'!A7:AN`);
  } catch {}

  // Build community leads lookup
  const leadsByCommunity = {};
  for (const row of leadsData) {
    const name = (row[0] || '').toString().trim();
    if (!name) continue;
    leadsByCommunity[name.toLowerCase()] = {
      totalDigital: toNum(row[2]),     // C
      totalInPerson: toNum(row[3]),    // D
      totalCalls: toNum(row[4]),       // E
      totalNewLeads: toNum(row[5]),    // F
      vipList: toNum(row[6]),          // G
      repDigital: toNum(row[38]),      // AM
      repPhoneCall: toNum(row[39]),    // AN
    };
  }

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

  // Read appointment counts (deduplicated)
  const apptCounts = {};
  try {
    const sData = await getSheetData(SALES_APP_SHEET_ID, 'Submissions');
    if (sData.length > 1) {
      const sH = sData[0];
      const sCommunityIdx = sH.indexOf('Community');
      const sApptsIdx = sH.indexOf('Total Appts');
      const sWeekIdx = sH.indexOf('Week Ending');
      const sRepIdx = sH.indexOf('Rep Name');
      const sTimestampIdx = sH.indexOf('Timestamp');

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
            latestByKey[key] = { ts, appts: toNum(sData[i][sApptsIdx]), community: comm };
          }
        }
        for (const entry of Object.values(latestByKey)) {
          const key = entry.community.toLowerCase();
          apptCounts[key] = (apptCounts[key] || 0) + entry.appts;
        }
      }
    }
  } catch {}

  // Build Sales Data Results
  const evergreenRows = [
    ['BOYL - CLT', 'CLT'], ['Renovations - CLT', 'CLT'], ['General - CLT', 'CLT'],
    ['BOYL - TRN', 'TRN'], ['Renovations - TRN', 'TRN'], ['General - TRN', 'TRN'],
    ['BOYL - GVL', 'GVL'], ['Renovations - GVL', 'GVL'], ['General - GVL', 'GVL'],
    ['General Overall', ''],
  ];
  const communities = await getCommunitiesFromAssignmentsSheet();
  const allRows = [
    ...evergreenRows,
    ...communities.map(c => [c.name, c.market]),
  ];

  // Ensure tab exists
  let resultsSheetId = await getSheetId(SALES_APP_SHEET_ID, 'Sales Data Results');
  if (resultsSheetId === null) {
    await batchUpdate(SALES_APP_SHEET_ID, [{
      addSheet: { properties: { title: 'Sales Data Results' } }
    }]);
  }

  // Clear and write
  try { await clearRange(SALES_APP_SHEET_ID, "'Sales Data Results'!A1:N100"); } catch {}

  // Header row
  const headerRow = [
    'Community', 'Division', 'Active Prospects', 'Appointments Held',
    'Total New Leads', 'Total Digital', 'Total In Person', 'Total Calls',
    'VIP List', 'Rep Direct Digital', 'Rep Direct Phone Call',
  ];

  const dataRows = allRows.map(([name, market]) => {
    const key = name.toLowerCase();
    const leads = leadsByCommunity[key] || {};
    const prospects = prospectCounts[key] || 0;
    const appts = apptCounts[key] || 0;

    return [
      name, market, prospects, appts,
      leads.totalNewLeads || 0,
      leads.totalDigital || 0,
      leads.totalInPerson || 0,
      leads.totalCalls || 0,
      leads.vipList || 0,
      leads.repDigital || 0,
      leads.repPhoneCall || 0,
    ];
  });

  await updateRange(SALES_APP_SHEET_ID, `'Sales Data Results'!A1:K1`, [headerRow]);
  if (dataRows.length > 0) {
    await updateRange(SALES_APP_SHEET_ID, `'Sales Data Results'!A2:K${1 + dataRows.length}`, dataRows);
  }

  return {
    success: true,
    rowsWritten: dataRows.length,
    leadsFound: Object.keys(leadsByCommunity).length,
  };
}

