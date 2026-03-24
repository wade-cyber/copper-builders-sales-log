// GET /api/get-assignments?rep=Name — returns assignments for a rep
// Without ?rep param: returns all unique communities (type=community)

import { getSheetData, SALES_APP_SHEET_ID } from './_lib/sheets.js';

export default async function handler(req, res) {
  try {
    const rep = req.query.rep || '';
    const data = await getSheetData(SALES_APP_SHEET_ID, 'Assignments');
    if (data.length < 2) return res.status(200).json([]);

    const headers = data[0];
    const nameIdx = headers.indexOf('Assignment Name');
    const typeIdx = headers.indexOf('Assignment Type');
    const repIdx = headers.indexOf('Rep Name');

    // No rep provided: return all unique communities
    if (!rep) {
      const seen = {};
      const results = [];
      for (let i = 1; i < data.length; i++) {
        const assignmentName = data[i][nameIdx];
        const assignmentType = (data[i][typeIdx] || 'community').toLowerCase();
        if (assignmentType === 'community' && !seen[assignmentName]) {
          seen[assignmentName] = true;
          results.push({ name: assignmentName, assignmentName, assignmentType: 'community' });
        }
      }
      return res.status(200).json(results);
    }

    // Rep provided: return that rep's assignments
    const results = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][repIdx] !== rep) continue;
      results.push({
        name: data[i][nameIdx],
        assignmentName: data[i][nameIdx],
        assignmentType: data[i][typeIdx] || 'community',
      });
    }
    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
