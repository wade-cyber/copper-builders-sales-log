// GET /api/get-prospects?rep=Name — returns active prospects for a rep

import { getSheetData, SALES_APP_SHEET_ID } from './_lib/sheets.js';

export default async function handler(req, res) {
  try {
    const rep = req.query.rep || '';
    const data = await getSheetData(SALES_APP_SHEET_ID, 'Prospects');
    if (data.length < 2) return res.status(200).json([]);

    const headers = data[0];
    const results = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const repName = row[headers.indexOf('Rep Name')];
      if (repName !== rep) continue;

      const status = (row[headers.indexOf('Status')] || 'active').toString().toLowerCase();
      if (status === 'sold' || status === 'removed') continue;

      results.push({
        id: row[headers.indexOf('ID')],
        rep: repName,
        community: row[headers.indexOf('Community')],
        name: row[headers.indexOf('Prospect Name')],
        ranking: row[headers.indexOf('Ranking')],
        nextStep: row[headers.indexOf('Next Step')],
        status,
        createdDate: row[headers.indexOf('Created Date')],
        lastUpdated: row[headers.indexOf('Last Updated')],
      });
    }

    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
