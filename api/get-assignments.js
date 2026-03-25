// GET /api/get-assignments?rep=Name — returns assignments for a rep
// Without ?rep param: returns all unique communities
// Reads directly from the Sales Rep Assignments Google Sheet

import { getSheetData, ASSIGNMENTS_SHEET_ID } from './_lib/sheets.js';

export default async function handler(req, res) {
  try {
    const rep = req.query.rep || '';
    const data = await getSheetData(ASSIGNMENTS_SHEET_ID, 'Assignments');
    if (data.length < 2) return res.status(200).json([]);

    const headers = data[0];
    const repIdx = headers.indexOf('Rep Name');
    const communityIdx = headers.indexOf('Community Name');
    const divisionIdx = headers.indexOf('Division');

    // Count communities for type determination
    const counts = {};
    for (let i = 1; i < data.length; i++) {
      const name = (data[i][communityIdx] || '').toString().trim();
      if (name) counts[name] = (counts[name] || 0) + 1;
    }

    // No rep provided: return all unique communities
    if (!rep) {
      const seen = {};
      const results = [];
      for (let i = 1; i < data.length; i++) {
        const name = (data[i][communityIdx] || '').toString().trim();
        const type = counts[name] > 1 ? 'community' : 'single-home';
        if (type === 'community' && !seen[name]) {
          seen[name] = true;
          results.push({ name, assignmentName: name, assignmentType: 'community' });
        }
      }
      return res.status(200).json(results);
    }

    // Rep provided: return that rep's assignments
    const results = [];
    const seen = new Set();
    for (let i = 1; i < data.length; i++) {
      const rowRep = (data[i][repIdx] || '').toString().trim();
      if (rowRep !== rep) continue;
      const name = (data[i][communityIdx] || '').toString().trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      results.push({
        name,
        assignmentName: name,
        assignmentType: counts[name] > 1 ? 'community' : 'single-home',
      });
    }
    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
