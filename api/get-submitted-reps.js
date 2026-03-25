// GET /api/get-submitted-reps — returns rep names who already submitted this week

import { getSheetData, getCurrentWeekEndingShort, SALES_APP_SHEET_ID } from './_lib/sheets.js';

export default async function handler(req, res) {
  try {
    const currentWeek = getCurrentWeekEndingShort();
    const data = await getSheetData(SALES_APP_SHEET_ID, 'Submissions');
    if (data.length < 2) return res.status(200).json([]);

    const headers = data[0];
    const weekIdx = headers.indexOf('Week Ending');
    const repIdx = headers.indexOf('Rep Name');

    const submitted = new Set();
    for (let i = 1; i < data.length; i++) {
      const week = (data[i][weekIdx] || '').toString().trim();
      if (week === currentWeek) {
        const rep = (data[i][repIdx] || '').toString().trim();
        if (rep) submitted.add(rep);
      }
    }

    return res.status(200).json([...submitted].sort());
  } catch (err) {
    return res.status(200).json([]);
  }
}
