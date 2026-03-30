// POST /api/save-prospect — dual-write to Supabase + Google Sheets

import {
  getSheetData, updateRange, appendRows, getSheetId, batchUpdate,
  SALES_APP_SHEET_ID,
} from './_lib/sheets.js';
import { supabase } from './_lib/db.js';
import { resolveOrCreateRep, resolveOrCreateCommunity, clearResolverCache } from './_lib/resolve-names.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const now = new Date().toISOString();
    clearResolverCache();

    // === STEP 1: Write to Supabase ===
    try {
      const rep = await resolveOrCreateRep(data.rep);
      const community = await resolveOrCreateCommunity(data.community);

      await supabase.from('prospects').upsert({
        id: data.id,
        rep_id: rep.id,
        community_id: community.id,
        prospect_name: data.name || null,
        ranking: data.ranking || 'C',
        next_step: data.nextStep || null,
        status: data.status || 'active',
        lot_number: data.lotNumber || null,
        created_date: data.createdDate || now,
        last_updated: now,
      }, { onConflict: 'id' });
    } catch (dbErr) {
      console.error('[save-prospect] Supabase write failed:', dbErr.message);
    }

    // === STEP 2: Write to Google Sheets (backward compat) ===
    let sheetId = await getSheetId(SALES_APP_SHEET_ID, 'Prospects');
    if (sheetId === null) {
      await batchUpdate(SALES_APP_SHEET_ID, [{
        addSheet: { properties: { title: 'Prospects' } }
      }]);
    }

    const allData = await getSheetData(SALES_APP_SHEET_ID, 'Prospects');
    await updateRange(SALES_APP_SHEET_ID, 'Prospects!A1:J1', [[
      'ID', 'Rep Name', 'Community', 'Prospect Name', 'Ranking',
      'Next Step', 'Status', 'Created Date', 'Last Updated', 'Lot Number'
    ]]);

    const rowData = [
      data.id, data.rep, data.community, data.name,
      data.ranking || 'C', data.nextStep || '', data.status || 'active',
      data.createdDate || now, now, data.lotNumber || '',
    ];

    const headers = allData[0] || [];
    const idCol = headers.indexOf('ID');
    let rowIndex = -1;
    for (let i = 1; i < allData.length; i++) {
      if (allData[i][idCol] === data.id) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex > 0) {
      await updateRange(SALES_APP_SHEET_ID, `Prospects!A${rowIndex}:J${rowIndex}`, [rowData]);
    } else {
      await appendRows(SALES_APP_SHEET_ID, 'Prospects', [rowData]);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
