// GET/POST /api/debug-consolidate — returns community names from both sheets for comparison

import {
  getSheetData, getSpreadsheet,
  LEADS_SHEET_ID, SALES_APP_SHEET_ID,
} from './_lib/sheets.js';

export default async function handler(req, res) {
  try {
    // Copper Leads Dashboard Template — community names from rows 3+
    const leadsNames = [];
    try {
      const ld = await getSheetData(LEADS_SHEET_ID, 'Dashboard Template!A3:B');
      for (let i = 0; i < ld.length; i++) {
        const n = (ld[i][0] || '').toString().trim();
        if (n) leadsNames.push({ row: i + 3, name: n, market: (ld[i][1] || '').toString().trim() });
      }
    } catch { /* no dashboard */ }

    // Sales Data Results — community names from all rows (now in Sales App sheet)
    const resultsNames = [];
    const resultsTabNames = [];

    const meta = await getSpreadsheet(SALES_APP_SHEET_ID);
    for (const sheet of meta.sheets) {
      resultsTabNames.push(sheet.properties.title);
    }

    try {
      const rd = await getSheetData(SALES_APP_SHEET_ID, 'Sales Data Results!A:B');
      for (let i = 0; i < rd.length; i++) {
        const n = (rd[i][0] || '').toString().trim();
        if (n) resultsNames.push({ row: i + 1, name: n, col_b: (rd[i][1] || '').toString().trim() });
      }
    } catch { /* no results tab */ }

    return res.status(200).json({
      copperLeadsDashboard: leadsNames,
      salesDataResults: resultsNames,
      salesAppTabs: resultsTabNames,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
