// GET /api/get-last-sync — returns last Smartsheet sync timestamp

import { getSheetData, SALES_APP_SHEET_ID } from './_lib/sheets.js';

export default async function handler(req, res) {
  try {
    const data = await getSheetData(SALES_APP_SHEET_ID, 'Assignments!G1');
    const val = data.length > 0 && data[0].length > 0 ? data[0][0] : null;
    return res.status(200).json({
      lastSynced: val ? new Date(val).toISOString() : null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
