// GET /api/get-reps — returns sorted unique rep names
// Only includes reps who have at least one assignment where
// "Sales reporting tool report this week?" = "yes"

import { getSheetData, ASSIGNMENTS_SHEET_ID } from './_lib/sheets.js';

export default async function handler(req, res) {
  try {
    const data = await getSheetData(ASSIGNMENTS_SHEET_ID, 'Assignments');
    if (data.length < 2) return res.status(200).json([]);

    const headers = data[0];
    const repIdx = headers.indexOf('Rep Name');
    const reportIdx = headers.indexOf('Sales reporting tool report this week?');

    const seen = {};
    const results = [];
    for (let i = 1; i < data.length; i++) {
      const reportThisWeek = (data[i][reportIdx] || '').toString().trim().toLowerCase();
      if (reportThisWeek !== 'yes') continue;

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
