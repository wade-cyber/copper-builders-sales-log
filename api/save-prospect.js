// POST /api/save-prospect — upsert a prospect row by ID

import {
  getSheetData, updateRange, appendRows, getSheetId, batchUpdate,
  SALES_APP_SHEET_ID,
} from './_lib/sheets.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    // Ensure Prospects tab exists
    let sheetId = await getSheetId(SALES_APP_SHEET_ID, 'Prospects');
    if (sheetId === null) {
      await batchUpdate(SALES_APP_SHEET_ID, [{
        addSheet: { properties: { title: 'Prospects' } }
      }]);
      await updateRange(SALES_APP_SHEET_ID, 'Prospects!A1:I1', [[
        'ID', 'Rep Name', 'Community', 'Prospect Name', 'Ranking',
        'Next Step', 'Status', 'Created Date', 'Last Updated'
      ]]);
    }

    // Check if header exists
    const allData = await getSheetData(SALES_APP_SHEET_ID, 'Prospects');
    if (allData.length === 0 || allData[0][0] !== 'ID') {
      await updateRange(SALES_APP_SHEET_ID, 'Prospects!A1:I1', [[
        'ID', 'Rep Name', 'Community', 'Prospect Name', 'Ranking',
        'Next Step', 'Status', 'Created Date', 'Last Updated'
      ]]);
    }

    const now = new Date().toISOString();
    const rowData = [
      data.id,
      data.rep,
      data.community,
      data.name,
      data.ranking || 'C',
      data.nextStep || '',
      data.status || 'active',
      data.createdDate || now,
      now,
    ];

    // Find existing row by ID
    const headers = allData[0] || [];
    const idCol = headers.indexOf('ID');
    let rowIndex = -1;
    for (let i = 1; i < allData.length; i++) {
      if (allData[i][idCol] === data.id) {
        rowIndex = i + 1; // 1-based
        break;
      }
    }

    if (rowIndex > 0) {
      await updateRange(SALES_APP_SHEET_ID, `Prospects!A${rowIndex}:I${rowIndex}`, [rowData]);
    } else {
      await appendRows(SALES_APP_SHEET_ID, 'Prospects', [rowData]);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
