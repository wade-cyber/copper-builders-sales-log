// GET /api/get-reps — returns sorted unique rep names
// Reads from the local "Weekly Assignments" cache tab (fast, pre-filtered)

import { getSheetData, SALES_APP_SHEET_ID } from './_lib/sheets.js';

export default async function handler(req, res) {
  try {
    const data = await getSheetData(SALES_APP_SHEET_ID, 'Weekly Assignments');
    if (data.length < 2) return res.status(200).json([]);

    const headers = data[0];
    const repIdx = headers.indexOf('Rep Name');

    const seen = {};
    const results = [];
    for (let i = 1; i < data.length; i++) {
      const name = (data[i][repIdx] || '').toString().trim();
      if (name && !seen[name]) {
        seen[name] = true;
        results.push(name);
      }
    }
    results.sort();
    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
