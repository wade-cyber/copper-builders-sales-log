// GET /api/get-last-sync — returns last assignment sync timestamp

import { getSheetData, SALES_APP_SHEET_ID } from './_lib/sheets.js';

export default async function handler(req, res) {
  try {
    // Read System Log for the latest sync entry
    const data = await getSheetData(SALES_APP_SHEET_ID, 'System Log');
    if (data.length < 2) return res.status(200).json({ lastSynced: null });

    // Find last sync entry (newest at bottom)
    let lastSynced = null;
    for (let i = data.length - 1; i >= 1; i--) {
      const action = (data[i][1] || '').toString();
      if (action.includes('sync') || action.includes('Sync')) {
        lastSynced = data[i][0]; // Timestamp column
        break;
      }
    }

    return res.status(200).json({
      lastSynced: lastSynced ? new Date(lastSynced).toISOString() : null,
    });
  } catch (err) {
    return res.status(200).json({ lastSynced: null });
  }
}
