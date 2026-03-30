// POST /api/monday-night — Monday midnight orchestrator
// Sales rep reporting tool only — no leads sheet management.
// Phase 1: Submission status report
// Phase 2: Cache assignments + consolidate data + write weekly stats to Assignments sheet

import {
  getSheetData, updateRange, clearRange, getSheetId, batchUpdate,
  getCurrentWeekEndingShort, getWeekEndingSunday, logToSystemLog, toNum, formatTabName,
  SALES_APP_SHEET_ID, ASSIGNMENTS_SHEET_ID, TEMPLATE_SHEET_ID,
} from './_lib/sheets.js';
import { getCommunitiesFromAssignmentsSheet, getRepsFromAssignmentsSheet } from './_lib/sync-from-assignments-sheet.js';

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
        console.error('[PHASE 2 TRIGGER FAILURE]', {
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
        });
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

async function runPhase2(targetDate = null) {
  // Step 2a: Cache assignments locally for fast app loading
  let assignmentResult = { success: false, message: 'skipped' };
  try {
    assignmentResult = await cacheAssignmentsLocally();
  } catch (e) {
    console.error('[Phase 2] Cache assignments failed:', { message: e.message, stack: e.stack });
    assignmentResult = { success: false, message: e.message };
  }

  // Step 2b: Run consolidation (writes Sales Data Results tab)
  let consolidateResult = { success: false, message: 'skipped' };
  try {
    consolidateResult = await runConsolidation();
  } catch (e) {
    console.error('[Phase 2] Consolidation failed:', { message: e.message, stack: e.stack });
    consolidateResult = { success: false, message: e.message };
  }

  // Step 2c: Write weekly results to "Last Weeks Results" tab (archive previous)
  let resultsResult = { success: false, message: 'skipped' };
  try {
    resultsResult = await writeWeeklyResults();
  } catch (e) {
    console.error('[Phase 2] Write weekly results failed:', { message: e.message, stack: e.stack });
    resultsResult = { success: false, message: e.message };
  }

  // Step 2d: Rotate OSC leads sheet (archive current, prep next week)
  let oscRotateResult = { success: false, message: 'skipped' };
  try {
    oscRotateResult = await rotateOSCLeadsSheet(targetDate);
  } catch (e) {
    console.error('[Phase 2] OSC rotate failed:', { message: e.message, stack: e.stack });
    oscRotateResult = { success: false, message: e.message };
  }

  await logToSystemLog('monday-night-phase2',
    (assignmentResult.success && consolidateResult.success && resultsResult.success && oscRotateResult.success) ? 'success' : 'partial',
    `Assignments: ${assignmentResult.success ? assignmentResult.count || 0 : 'FAILED: ' + assignmentResult.message}. Consolidation: ${consolidateResult.success || 'FAILED: ' + consolidateResult.message}. Results: ${resultsResult.success ? resultsResult.rowsWritten || 0 : 'FAILED: ' + resultsResult.message}. OSC rotate: ${oscRotateResult.success || 'FAILED: ' + oscRotateResult.message}.`);

  return {
    success: true,
    assignments: assignmentResult,
    consolidation: consolidateResult,
    weeklyResults: resultsResult,
    oscRotation: oscRotateResult,
  };
}

// ═══════════════════════════════════════════════════════════
// WRITE WEEKLY RESULTS — separate tab, archived each week
// ═══════════════════════════════════════════════════════════

async function writeWeeklyResults() {
  const currentWeekEnding = getCurrentWeekEndingShort();

  // Step 1: Archive or delete existing "Last Weeks Results" tab
  const existingId = await getSheetId(SALES_APP_SHEET_ID, 'Last Weeks Results');
  if (existingId !== null) {
    const archiveName = `Results — ${currentWeekEnding}`;
    const archiveId = await getSheetId(SALES_APP_SHEET_ID, archiveName);
    if (archiveId === null) {
      // Rename to archive
      await batchUpdate(SALES_APP_SHEET_ID, [{
        updateSheetProperties: {
          properties: { sheetId: existingId, title: archiveName },
          fields: 'title',
        }
      }]);
    } else {
      // Archive already exists (re-run) — just delete the old Last Weeks Results
      await batchUpdate(SALES_APP_SHEET_ID, [{
        deleteSheet: { sheetId: existingId }
      }]);
    }
  }

  // Step 2: Create fresh "Last Weeks Results" tab
  await batchUpdate(SALES_APP_SHEET_ID, [{
    addSheet: { properties: { title: 'Last Weeks Results' } }
  }]);

  // Step 3: Read all data sources

  // 3a: Assignments (rep + community + division)
  const assignData = await getSheetData(ASSIGNMENTS_SHEET_ID, 'Assignments');
  if (assignData.length < 2) return { success: true, rowsWritten: 0 };

  const aHeaders = assignData[0];
  const aRepIdx = aHeaders.indexOf('Rep Name');
  let aCommunityIdx = aHeaders.indexOf('Community Name');
  if (aCommunityIdx < 0) aCommunityIdx = aHeaders.indexOf('Community or House Name');
  const aDivisionIdx = aHeaders.indexOf('Division');

  // 3b: Submissions (deduplicated by rep+community for current week)
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
      const sDLIPIdx = sH.indexOf('Direct Leads In Person');
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
            dlInPerson: sDLIPIdx >= 0 ? toNum(sData[i][sDLIPIdx]) : 0,
            sold: sSoldIdx >= 0 ? toNum(sData[i][sSoldIdx]) : 0,
          };
        }
      }
    }
  } catch {}

  // 3c: Prospects (active counts per rep+community)
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

  // 3d: OSC leads — read full width (A through AM = 39 cols) to capture all data
  const oscByCommunity = {};
  try {
    const oscData = await getSheetData(TEMPLATE_SHEET_ID, "'Dashboard Template'!A7:AM");
    for (const row of (oscData || [])) {
      const name = (row[0] || '').toString().trim();
      if (!name) continue;
      oscByCommunity[name.toLowerCase()] = {
        digital: toNum(row[2]),
        inPerson: toNum(row[3]),
        callIn: toNum(row[4]),
      };
    }
  } catch {}

  // Step 4: Build results rows
  const header = [
    'Week Ending', 'Rep Name', 'Community', 'Division', 'Report Date',
    'Sales', 'Prospects', 'Appts Held', 'Sales Rep Leads',
    'OSC Digital Leads', 'OSC In Person Leads', 'OSC Call-In Leads', 'Total Leads',
  ];

  const rows = [];
  for (let i = 1; i < assignData.length; i++) {
    const rep = (assignData[i][aRepIdx] || '').toString().trim();
    const comm = aCommunityIdx >= 0 ? (assignData[i][aCommunityIdx] || '').toString().trim() : '';
    const div = aDivisionIdx >= 0 ? (assignData[i][aDivisionIdx] || '').toString().trim() : '';
    const key = `${rep}||${comm}`;

    const sub = subsByRepComm[key];
    const prospects = prospectsByRepComm[key] || 0;
    const osc = oscByCommunity[comm.toLowerCase()] || { digital: 0, inPerson: 0, callIn: 0 };
    const oscTotal = osc.digital + osc.inPerson + osc.callIn;

    const reportDate = sub?.ts ? new Date(sub.ts).toLocaleDateString('en-US') : '';
    const sales = sub?.sold || 0;
    const appts = sub?.appts || 0;
    const repLeads = (sub?.dlDigital || 0) + (sub?.dlPhone || 0) + (sub?.dlInPerson || 0);

    rows.push([
      currentWeekEnding, rep, comm, div, reportDate,
      sales, prospects, appts, repLeads,
      osc.digital, osc.inPerson, osc.callIn, repLeads + oscTotal,
    ]);
  }

  // Step 5: Write to "Last Weeks Results" tab
  await updateRange(SALES_APP_SHEET_ID, `'Last Weeks Results'!A1:M1`, [header]);
  if (rows.length > 0) {
    await updateRange(SALES_APP_SHEET_ID, `'Last Weeks Results'!A2:M${1 + rows.length}`, rows);
  }

  return { success: true, rowsWritten: rows.length };
}

// ═══════════════════════════════════════════════════════════
// ROTATE OSC LEADS SHEET
// ═══════════════════════════════════════════════════════════

async function rotateOSCLeadsSheet(targetDate = null) {
  const OSC_SHEET = TEMPLATE_SHEET_ID;
  const DASHBOARD_TAB = 'Dashboard Template';
  const TOTAL_COLS = 39; // A through AM

  // Calculate dates using shared utility — consistent with getCurrentWeekEndingShort()
  const currentSunday = getWeekEndingSunday(targetDate);
  const previousSunday = new Date(currentSunday);
  previousSunday.setDate(currentSunday.getDate() - 7);

  const archiveName = formatTabName(previousSunday);
  const weekEndingDate = `${currentSunday.getMonth() + 1}/${currentSunday.getDate()}/${String(currentSunday.getFullYear()).slice(2)}`;

  const dashSheetId = await getSheetId(OSC_SHEET, DASHBOARD_TAB);
  if (dashSheetId === null) {
    return { success: false, message: 'Dashboard Template tab not found' };
  }

  // Step 1: Archive — duplicate Dashboard Template as "Week of [date]"
  let archiveSkipped = false;
  const existingArchive = await getSheetId(OSC_SHEET, archiveName);
  if (existingArchive !== null) {
    console.log(`Archive tab '${archiveName}' already exists, skipping archive step`);
    archiveSkipped = true;
  } else {
    // Duplicate preserves ALL formatting and data (including protections on the copy)
    try {
      await batchUpdate(OSC_SHEET, [{
        duplicateSheet: {
          sourceSheetId: dashSheetId,
          newSheetName: archiveName,
        }
      }]);
    } catch (e) {
      console.error('[OSC Rotate] Step 1 (archive) failed:', e.message);
      archiveSkipped = true;
    }
  }

  // All remaining steps run regardless of archive status

  // Step 2: Clear community data cells in Dashboard Template (preserve formatting)
  // Only clear rows 13+ (community data). Skip protected columns C-F.
  const allData = await getSheetData(OSC_SHEET, `'${DASHBOARD_TAB}'!A1:A`);
  const lastRow = allData.length;

  if (lastRow >= 13) {
    const dataRowCount = lastRow - 13 + 1;
    // Only zero out G through AM (33 cols), skip protected C-F.
    const zeroRow = Array(TOTAL_COLS - 6).fill(0); // cols G through AM = 33 cols
    const zeros = Array.from({ length: dataRowCount }, () => [...zeroRow]);
    try {
      await updateRange(OSC_SHEET, `'${DASHBOARD_TAB}'!G13:AM${lastRow}`, zeros);
    } catch (e) {
      console.error('[OSC Rotate] Step 2 (clear G13:AM) failed:', e.message);
    }
  }

  // Step 3: Update week ending date
  try {
    await updateRange(OSC_SHEET, `'${DASHBOARD_TAB}'!B2`, [[weekEndingDate]]);
  } catch (e) {
    console.error('[OSC Rotate] Step 3 (update B2 date) failed:', e.message);
  }

  // Step 4: Sync communities (rows 13+) from Assignments sheet
  // Overwrite in place — no row delete/insert (protected columns block structural changes).
  const newCommunities = await getCommunitiesFromAssignmentsSheet();

  let communitiesUpdated = 0;
  if (newCommunities.length > 0) {
    // Write community names + divisions into A13:B (skip protected C-F)
    const nameRows = newCommunities.map(c => [c.name, c.market]);
    await updateRange(OSC_SHEET,
      `'${DASHBOARD_TAB}'!A13:B${12 + newCommunities.length}`,
      nameRows
    );
    communitiesUpdated = newCommunities.length;

    // If there were more old rows than new, clear the leftover names
    if (lastRow > 12 + newCommunities.length) {
      const extraRows = lastRow - (12 + newCommunities.length);
      const blankRows = Array.from({ length: extraRows }, () => ['', '']);
      await updateRange(OSC_SHEET,
        `'${DASHBOARD_TAB}'!A${13 + newCommunities.length}:B${lastRow}`,
        blankRows
      );
    }
  }

  return {
    success: true,
    archived: archiveSkipped ? `${archiveName} (already existed)` : archiveName,
    archiveSkipped,
    weekEndingDate,
    communitiesUpdated,
    communitiesChanged: !communitiesMatch,
  };
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
    // Skip placeholder reps — these are leads-only entries, not sales rep assignments
    const repLower = rep.toLowerCase();
    if (repLower === 'n/a' || repLower === 'none' || repLower === 'na') continue;
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
      const sInPersonIdx = sH.indexOf('Direct Leads In Person');
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
              inPerson: sInPersonIdx >= 0 ? toNum(sData[i][sInPersonIdx]) : 0,
              sold: sSoldIdx >= 0 ? toNum(sData[i][sSoldIdx]) : 0,
            };
          }
        }
        for (const entry of Object.values(latestByKey)) {
          const key = entry.community.toLowerCase();
          apptCounts[key] = (apptCounts[key] || 0) + entry.appts;
          soldCounts[key] = (soldCounts[key] || 0) + entry.sold;
          if (!directLeadCounts[key]) directLeadCounts[key] = { digital: 0, phoneCall: 0, inPerson: 0 };
          directLeadCounts[key].digital += entry.digital;
          directLeadCounts[key].phoneCall += entry.phoneCall;
          directLeadCounts[key].inPerson += entry.inPerson;
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
    'Rep Direct Digital', 'Rep Direct Phone Call', 'Rep Direct In Person', 'Total Rep Leads',
  ];

  const dataRows = allRows.map(([name, market]) => {
    const key = name.toLowerCase();
    const prospects = prospectCounts[key] || 0;
    const appts = apptCounts[key] || 0;
    const sales = soldCounts[key] || 0;
    const dl = directLeadCounts[key] || { digital: 0, phoneCall: 0, inPerson: 0 };

    return [name, market, sales, prospects, appts, dl.digital, dl.phoneCall, dl.inPerson, dl.digital + dl.phoneCall + dl.inPerson];
  });

  await updateRange(SALES_APP_SHEET_ID, `'Sales Data Results'!A1:I1`, [headerRow]);
  if (dataRows.length > 0) {
    await updateRange(SALES_APP_SHEET_ID, `'Sales Data Results'!A2:I${1 + dataRows.length}`, dataRows);
  }

  return { success: true, rowsWritten: dataRows.length };
}
// force rebuild 1774478375
