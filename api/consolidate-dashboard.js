// POST /api/consolidate-dashboard — consolidates lead/prospect/appointment data
// into Sales Data Results + builds Sales Reports tab.
// Vercel cron: Tuesday 5:00 UTC

import {
  getSheetData, updateRange, clearRange, getSheetId, batchUpdate, getSpreadsheet,
  getCommunityListFromAssignments, getUniqueRepsFromAssignments,
  getCurrentWeekEndingShort, logToSystemLog, toNum,
  SALES_APP_SHEET_ID, LEADS_SHEET_ID, RESULTS_SHEET_ID,
} from './_lib/sheets.js';

export default async function handler(req, res) {
  try {
    const result = await consolidateDashboard();
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Consolidation failed: ' + err.message });
  }
}

async function consolidateDashboard() {
  // ── 1. Read Copper Leads Dashboard ──
  let leadsData;
  try {
    leadsData = await getSheetData(LEADS_SHEET_ID, 'Dashboard!A3:AJ');
  } catch {
    return { success: false, message: 'Copper Leads "Dashboard" tab not found' };
  }

  if (!leadsData || leadsData.length === 0) {
    return { success: false, message: 'Copper Leads Dashboard has no data rows' };
  }

  // Build lookup: community name (lowercase) → lead metrics
  const leadsByCommunity = {};
  for (const row of leadsData) {
    const communityName = (row[0] || '').toString().trim();
    if (!communityName) continue;

    const totalNewLeads = toNum(row[2]);

    let digitalLeads = 0;
    for (let d = 3; d <= 12; d++) digitalLeads += toNum(row[d]);

    let inPersonLeads = 0;
    for (let p = 13; p <= 23; p++) inPersonLeads += toNum(row[p]);

    let callLeads = 0;
    for (let c = 24; c <= 32; c++) callLeads += toNum(row[c]);

    const vipListSignups = toNum(row[33]);

    leadsByCommunity[communityName.toLowerCase()] = {
      totalNewLeads, digitalLeads, inPersonLeads, callLeads, vipListSignups,
    };
  }

  // ── 2. Count active prospects per community ──
  const prospectCounts = {};
  try {
    const pData = await getSheetData(SALES_APP_SHEET_ID, 'Prospects');
    if (pData.length > 1) {
      const pH = pData[0];
      const pCommunityIdx = pH.indexOf('Community');
      const pStatusIdx = pH.indexOf('Status');

      if (pCommunityIdx >= 0 && pStatusIdx >= 0) {
        for (let i = 1; i < pData.length; i++) {
          const status = (pData[i][pStatusIdx] || 'active').toString().toLowerCase();
          if (status !== 'active') continue;
          const comm = (pData[i][pCommunityIdx] || '').toString().trim().toLowerCase();
          if (comm) prospectCounts[comm] = (prospectCounts[comm] || 0) + 1;
        }
      }
    }
  } catch { /* no Prospects tab yet */ }

  // ── 3. Sum appointments held per community (deduplicated) ──
  const apptCounts = {};
  try {
    const sData = await getSheetData(SALES_APP_SHEET_ID, 'Submissions');
    if (sData.length > 1) {
      const sH = sData[0];
      const sCommunityIdx = sH.indexOf('Community');
      const sApptsIdx = sH.indexOf('Total Appts');
      const sWeekIdx = sH.indexOf('Week Ending');
      const sMarketIdx = sH.indexOf('Market');
      const sSectionTypeIdx = sH.indexOf('Section Type');
      const sRepIdx = sH.indexOf('Rep Name');
      const sTimestampIdx = sH.indexOf('Timestamp');

      if (sCommunityIdx >= 0 && sApptsIdx >= 0) {
        const currentWeekEnding = getCurrentWeekEndingShort();

        // Pass 1: Deduplicate — keep latest per (rep, community, weekEnding)
        const latestByKey = {};
        for (let i = 1; i < sData.length; i++) {
          const weekVal = (sData[i][sWeekIdx] || '').toString().trim();
          if (sWeekIdx >= 0 && currentWeekEnding && weekVal !== currentWeekEnding) continue;

          const repName = sRepIdx >= 0 ? (sData[i][sRepIdx] || '').toString().trim() : '';
          const comm = (sData[i][sCommunityIdx] || '').toString().trim();
          const timestamp = sTimestampIdx >= 0 ? (sData[i][sTimestampIdx] || '').toString() : '';

          const dedupKey = repName + '||' + comm + '||' + weekVal;
          if (!latestByKey[dedupKey] || timestamp > latestByKey[dedupKey].timestamp) {
            latestByKey[dedupKey] = { row: sData[i], timestamp };
          }
        }

        // Pass 2: Sum appointments from deduplicated entries
        for (const entry of Object.values(latestByKey)) {
          const row = entry.row;
          const comm = (row[sCommunityIdx] || '').toString().trim();
          const sectionType = sSectionTypeIdx >= 0 ? (row[sSectionTypeIdx] || '').toString().trim().toLowerCase() : '';
          const market = sMarketIdx >= 0 ? (row[sMarketIdx] || '').toString().trim() : '';

          let apptKey = comm;
          if ((sectionType === 'boyl' || sectionType === 'renovation') && market) {
            apptKey = comm + ' - ' + market;
          }

          const appts = toNum(row[sApptsIdx]);
          if (apptKey) apptCounts[apptKey.toLowerCase()] = (apptCounts[apptKey.toLowerCase()] || 0) + appts;
        }
      }
    }
  } catch { /* no Submissions tab yet */ }

  // ── 4. Write to Sales Data Results ──
  const resultsSheetId = await getSheetId(RESULTS_SHEET_ID, 'Sales Data Results');
  if (resultsSheetId === null) {
    return { success: false, message: '"Sales Data Results" tab not found in results sheet' };
  }

  // 4a: Dynamic row rebuild
  const evergreenRows = [
    ['BOYL - CLT', 'CLT'],
    ['Renovations - CLT', 'CLT'],
    ['General - CLT', 'CLT'],
    ['BOYL - TRN', 'TRN'],
    ['Renovations - TRN', 'TRN'],
    ['General - TRN', 'TRN'],
    ['BOYL - GVL', 'GVL'],
    ['Renovations - GVL', 'GVL'],
    ['General - GVL', 'GVL'],
    ['General Overall', ''],
  ];

  const communities = await getCommunityListFromAssignments();
  const allRows = [
    ...evergreenRows,
    ...communities.map(c => [c.name, c.market]),
  ];

  // Clear existing content
  try {
    const existingData = await getSheetData(RESULTS_SHEET_ID, 'Sales Data Results');
    if (existingData.length > 0) {
      await clearRange(RESULTS_SHEET_ID, `'Sales Data Results'!A1:L${Math.max(existingData.length, allRows.length) + 5}`);
    }
  } catch { /* empty sheet */ }

  // Write community names (cols A-B)
  if (allRows.length > 0) {
    await updateRange(RESULTS_SHEET_ID, `'Sales Data Results'!A1:B${allRows.length}`, allRows);
  }

  // 4b: Populate data columns
  const colC = []; // Active Prospects
  const colD = []; // Appointments Held
  const colE = []; // Total New Leads
  const colG = []; // Digital Leads
  const colH = []; // In-Person Leads
  const colJ = []; // Call Leads
  const colL = []; // VIP List Signups

  let rowsUpdated = 0;

  for (let i = 0; i < allRows.length; i++) {
    const name = allRows[i][0];
    const key = name.toLowerCase();
    const leads = leadsByCommunity[key];
    const prospects = prospectCounts[key] || 0;
    const appts = apptCounts[key] || 0;

    if (!leads && prospects === 0 && appts === 0) {
      colC.push(['']); colD.push(['']); colE.push(['']);
      colG.push(['']); colH.push(['']); colJ.push(['']); colL.push(['']);
      continue;
    }

    colC.push([prospects]);
    colD.push([appts]);
    colE.push([leads ? leads.totalNewLeads : '']);
    colG.push([leads ? leads.digitalLeads : '']);
    colH.push([leads ? leads.inPersonLeads : '']);
    colJ.push([leads ? leads.callLeads : '']);
    colL.push([leads ? leads.vipListSignups : '']);
    rowsUpdated++;
  }

  const n = allRows.length;
  // Write all 7 data columns in parallel
  await Promise.all([
    updateRange(RESULTS_SHEET_ID, `'Sales Data Results'!C1:C${n}`, colC),
    updateRange(RESULTS_SHEET_ID, `'Sales Data Results'!D1:D${n}`, colD),
    updateRange(RESULTS_SHEET_ID, `'Sales Data Results'!E1:E${n}`, colE),
    updateRange(RESULTS_SHEET_ID, `'Sales Data Results'!G1:G${n}`, colG),
    updateRange(RESULTS_SHEET_ID, `'Sales Data Results'!H1:H${n}`, colH),
    updateRange(RESULTS_SHEET_ID, `'Sales Data Results'!J1:J${n}`, colJ),
    updateRange(RESULTS_SHEET_ID, `'Sales Data Results'!L1:L${n}`, colL),
  ]);

  // ── 5. Build Sales Reports tab ──
  await buildSalesReports();

  // ── 6. System log ──
  await logToSystemLog('consolidateDashboard', 'success',
    `Consolidated ${rowsUpdated} rows, ${Object.keys(leadsByCommunity).length} leads sources`);

  return {
    success: true,
    rowsUpdated,
    leadsFound: Object.keys(leadsByCommunity).length,
    message: `Consolidated ${rowsUpdated} rows to Sales Data Results`,
  };
}

async function buildSalesReports() {
  const REPS = await getUniqueRepsFromAssignments();

  // Get or create Sales Reports tab
  let reportSheetId = await getSheetId(RESULTS_SHEET_ID, 'Sales Reports');
  if (reportSheetId === null) {
    await batchUpdate(RESULTS_SHEET_ID, [{
      addSheet: { properties: { title: 'Sales Reports' } }
    }]);
    reportSheetId = await getSheetId(RESULTS_SHEET_ID, 'Sales Reports');
  } else {
    // Clear existing content
    try {
      await clearRange(RESULTS_SHEET_ID, "'Sales Reports'!A1:Z100");
    } catch { /* empty */ }
  }

  const currentWeekEnding = getCurrentWeekEndingShort();

  // Check which reps submitted
  const submittedReps = {};
  try {
    const sData = await getSheetData(SALES_APP_SHEET_ID, 'Submissions');
    if (sData.length > 1) {
      const sH = sData[0];
      const sRepIdx = sH.indexOf('Rep Name');
      const sWeekIdx = sH.indexOf('Week Ending');
      const sTimestampIdx = sH.indexOf('Timestamp');

      if (sRepIdx >= 0) {
        for (let i = 1; i < sData.length; i++) {
          const weekVal = (sData[i][sWeekIdx] || '').toString().trim();
          if (sWeekIdx >= 0 && currentWeekEnding && weekVal !== currentWeekEnding) continue;
          const repName = (sData[i][sRepIdx] || '').toString().trim();
          if (repName) submittedReps[repName] = (sData[i][sTimestampIdx] || '').toString();
        }
      }
    }
  } catch { /* no submissions */ }

  // Check if leads data exists
  let hasLeadsData = false;
  try {
    const leadsData = await getSheetData(LEADS_SHEET_ID, 'Dashboard!A3:AJ');
    if (leadsData && leadsData.length > 0) {
      for (const row of leadsData) {
        for (let c = 2; c < row.length; c++) {
          if (toNum(row[c]) > 0) { hasLeadsData = true; break; }
        }
        if (hasLeadsData) break;
      }
    }
  } catch { /* no dashboard */ }

  // Build report rows
  const rows = [
    ['Sales Reports — Week Ending ' + currentWeekEnding, '', ''],
    ['', '', ''],
    ['Rep Name', 'Sales Log', 'Leads Report'],
  ];

  for (const rep of REPS) {
    const salesStatus = submittedReps[rep] ? 'Submitted' : 'MISSING';
    const leadsStatus = hasLeadsData ? 'COMPLETE' : 'NOT SUBMITTED';
    rows.push([rep, salesStatus, leadsStatus]);
  }

  // Timestamp footer
  const now = new Date();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const hour = now.getHours();
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  const min = now.getMinutes().toString().padStart(2, '0');
  const updateLabel = `Data last updated: ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()} ${h12}:${min} ${ampm} ET`;
  rows.push(['', '', '']);
  rows.push([updateLabel, '', '']);

  await updateRange(RESULTS_SHEET_ID, `'Sales Reports'!A1:C${rows.length}`, rows);

  // Bold header rows and style footer
  await batchUpdate(RESULTS_SHEET_ID, [
    {
      repeatCell: {
        range: { sheetId: reportSheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 3 },
        cell: { userEnteredFormat: { textFormat: { bold: true } } },
        fields: 'userEnteredFormat.textFormat.bold',
      }
    },
    {
      repeatCell: {
        range: { sheetId: reportSheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 3 },
        cell: { userEnteredFormat: { textFormat: { bold: true } } },
        fields: 'userEnteredFormat.textFormat.bold',
      }
    },
    {
      repeatCell: {
        range: { sheetId: reportSheetId, startRowIndex: rows.length - 1, endRowIndex: rows.length, startColumnIndex: 0, endColumnIndex: 3 },
        cell: {
          userEnteredFormat: {
            textFormat: { italic: true, foregroundColor: { red: 0.53, green: 0.53, blue: 0.53 } }
          }
        },
        fields: 'userEnteredFormat.textFormat',
      }
    },
  ]);
}
