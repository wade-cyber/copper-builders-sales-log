// POST /api/submit-weekly-log — append weekly submission rows + update prospect statuses

import {
  getSheetData, updateRange, appendRows, getSheetId, batchUpdate,
  SALES_APP_SHEET_ID,
} from './_lib/sheets.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    // Ensure Submissions tab exists with header
    let sheetId = await getSheetId(SALES_APP_SHEET_ID, 'Submissions');
    if (sheetId === null) {
      await batchUpdate(SALES_APP_SHEET_ID, [{
        addSheet: { properties: { title: 'Submissions' } }
      }]);
    }

    // Always write the full header to ensure all columns exist
    await updateRange(SALES_APP_SHEET_ID, 'Submissions!A1:W1', [[
      'Timestamp', 'Week Ending', 'Rep Name', 'Community', 'Section Type',
      'Client Only Virtual', 'Client Only Onsite', 'Client Only Model',
      'Realtor+Client Virtual', 'Realtor+Client Onsite', 'Realtor+Client Model',
      'Realtor Only Virtual', 'Realtor Only Onsite', 'Realtor Only Model',
      'Total Appts', 'Active Prospects', 'Sold Prospects', 'Removed Prospects',
      'Grand Total Appts', 'Grand Total Prospects', 'Market',
      'Direct Leads Digital', 'Direct Leads Phone Call'
    ]]);

    // Build rows from sections
    const sections = data.sections || [];
    const rows = [];
    for (const section of sections) {
      const appts = section.appointments || {};
      const co = appts.clientOnly || {};
      const rc = appts.realtorPlusClient || {};
      const ro = appts.realtorOnly || {};
      const prospects = section.prospects || [];

      const dl = section.directLeads || {};

      rows.push([
        data.timestamp,
        data.weekEnding,
        data.repName,
        section.name,
        section.type,
        co.virtual || 0,
        co.onsite || 0,
        co.model || 0,
        rc.virtual || 0,
        rc.onsite || 0,
        rc.model || 0,
        ro.virtual || 0,
        ro.onsite || 0,
        ro.model || 0,
        section.totalAppointments || 0,
        prospects.filter(p => p.status === 'active').length,
        prospects.filter(p => p.status === 'sold').length,
        prospects.filter(p => p.status === 'removed').length,
        (data.totals || {}).totalAppointments || 0,
        (data.totals || {}).totalProspects || 0,
        section.market || '',
        dl.digital || 0,
        dl.phoneCall || 0,
      ]);
    }

    if (rows.length > 0) {
      await appendRows(SALES_APP_SHEET_ID, 'Submissions', rows);
    }

    // Update prospect statuses for sold/removed
    await updateProspectStatuses(data.repName, sections);

    return res.status(200).json({ success: true, message: 'Submitted successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function updateProspectStatuses(repName, sections) {
  const allData = await getSheetData(SALES_APP_SHEET_ID, 'Prospects');
  if (allData.length < 2) return;

  const headers = allData[0];
  const nameCol = headers.indexOf('Prospect Name');
  const repCol = headers.indexOf('Rep Name');
  const statusCol = headers.indexOf('Status');
  const updatedCol = headers.indexOf('Last Updated');
  const rankingCol = headers.indexOf('Ranking');
  const nextStepCol = headers.indexOf('Next Step');

  if (nameCol < 0 || repCol < 0 || statusCol < 0) return;

  const now = new Date().toISOString();

  for (const section of sections) {
    const prospects = section.prospects || [];
    for (const prospect of prospects) {
      if (prospect.status !== 'sold' && prospect.status !== 'removed') continue;

      // Find matching row
      for (let r = 1; r < allData.length; r++) {
        if (allData[r][repCol] === repName && allData[r][nameCol] === prospect.name) {
          const rowNum = r + 1; // 1-based

          // Update status
          await updateRange(SALES_APP_SHEET_ID, `Prospects!${colLetter(statusCol)}${rowNum}`, [[prospect.status]]);

          if (updatedCol >= 0) {
            await updateRange(SALES_APP_SHEET_ID, `Prospects!${colLetter(updatedCol)}${rowNum}`, [[now]]);
          }
          if (rankingCol >= 0 && prospect.ranking) {
            await updateRange(SALES_APP_SHEET_ID, `Prospects!${colLetter(rankingCol)}${rowNum}`, [[prospect.ranking]]);
          }
          if (nextStepCol >= 0 && prospect.nextStep) {
            await updateRange(SALES_APP_SHEET_ID, `Prospects!${colLetter(nextStepCol)}${rowNum}`, [[prospect.nextStep]]);
          }
          break;
        }
      }
    }
  }
}

/** Converts 0-based column index to letter (0→A, 1→B, ..., 25→Z). */
function colLetter(idx) {
  return String.fromCharCode(65 + idx);
}
