// GET /api/get-assignments?rep=Name — returns assignments for a rep
// Without ?rep param: returns all unique communities
// Only includes assignments where "Sales reporting tool report this week?" = "yes"

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
    const reportIdx = headers.indexOf('Sales reporting tool report this week?');

    // Filter to only rows where "Sales reporting tool report this week?" = "yes"
    const activeRows = [];
    for (let i = 1; i < data.length; i++) {
      const reportThisWeek = (data[i][reportIdx] || '').toString().trim().toLowerCase();
      if (reportThisWeek === 'yes') activeRows.push(data[i]);
    }

    // Count communities for type determination
    const counts = {};
    for (const row of activeRows) {
      const name = (row[communityIdx] || '').toString().trim();
      if (name) counts[name] = (counts[name] || 0) + 1;
    }

    // No rep provided: return all unique communities
    if (!rep) {
      const seen = {};
      const results = [];
      for (const row of activeRows) {
        const name = (row[communityIdx] || '').toString().trim();
        const type = counts[name] > 1 ? 'community' : 'single-home';
        if (type === 'community' && !seen[name]) {
          seen[name] = true;
          results.push({ name, assignmentName: name, assignmentType: 'community' });
        }
      }
      return res.status(200).json(results);
    }

    // Rep provided: return that rep's active assignments
    const results = [];
    const seen = new Set();
    for (const row of activeRows) {
      const rowRep = (row[repIdx] || '').toString().trim();
      if (rowRep !== rep) continue;
      const name = (row[communityIdx] || '').toString().trim();
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
