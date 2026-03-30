// POST /api/submit-weekly-log — dual-write to Supabase + Google Sheets

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
    clearResolverCache();

    // === STEP 1: Write to Supabase (primary) ===
    let dbSuccess = false;
    try {
      const rep = await resolveOrCreateRep(data.repName);
      const sections = data.sections || [];

      for (const section of sections) {
        const community = await resolveOrCreateCommunity(section.name);
        const appts = section.appointments || {};
        const prospects = section.prospects || [];
        const dl = section.directLeads || {};

        await supabase.from('weekly_submissions').upsert({
          rep_id: rep.id,
          community_id: community.id,
          week_ending: parseWeekEnding(data.weekEnding),
          section_type: section.type || null,
          appts_virtual: appts.virtual || 0,
          appts_in_person: appts.inPerson || 0,
          total_appts: section.totalAppointments || 0,
          leads_digital: dl.digital || 0,
          leads_phone: dl.phoneCall || 0,
          leads_in_person: dl.inPerson || 0,
          active_prospects: prospects.filter(p => p.status === 'active').length,
          sold_prospects: prospects.filter(p => p.status === 'sold').length,
          removed_prospects: prospects.filter(p => p.status === 'removed').length,
          grand_total_appts: (data.totals || {}).totalAppointments || 0,
          submitted_at: data.timestamp || new Date().toISOString(),
        }, { onConflict: 'rep_id,community_id,week_ending' });
      }
      dbSuccess = true;
    } catch (dbErr) {
      console.error('[submit-weekly-log] Supabase write failed:', dbErr.message);
      // Continue to Sheets write as fallback
    }

    // === STEP 2: Write to Google Sheets (backward compat) ===
    let sheetsSuccess = false;
    try {
      let sheetId = await getSheetId(SALES_APP_SHEET_ID, 'Submissions');
      if (sheetId === null) {
        await batchUpdate(SALES_APP_SHEET_ID, [{
          addSheet: { properties: { title: 'Submissions' } }
        }]);
      }

      await updateRange(SALES_APP_SHEET_ID, 'Submissions!A1:O1', [[
        'Timestamp', 'Week Ending', 'Rep Name', 'Community', 'Section Type',
        'Appts Virtual', 'Appts In Person', 'Total Appts',
        'Direct Leads Digital', 'Direct Leads Phone Call', 'Direct Leads In Person',
        'Active Prospects', 'Sold Prospects', 'Removed Prospects',
        'Grand Total Appts',
      ]]);

      const sections = data.sections || [];
      const rows = [];
      for (const section of sections) {
        const appts = section.appointments || {};
        const prospects = section.prospects || [];
        const dl = section.directLeads || {};

        rows.push([
          data.timestamp,
          data.weekEnding,
          data.repName,
          section.name,
          section.type,
          appts.virtual || 0,
          appts.inPerson || 0,
          section.totalAppointments || 0,
          dl.digital || 0,
          dl.phoneCall || 0,
          dl.inPerson || 0,
          prospects.filter(p => p.status === 'active').length,
          prospects.filter(p => p.status === 'sold').length,
          prospects.filter(p => p.status === 'removed').length,
          (data.totals || {}).totalAppointments || 0,
        ]);
      }

      if (rows.length > 0) {
        await appendRows(SALES_APP_SHEET_ID, 'Submissions', rows);
      }

      await updateProspectStatuses(data.repName, data.sections || []);
      sheetsSuccess = true;
    } catch (sheetsErr) {
      console.error('[submit-weekly-log] Sheets write failed:', sheetsErr.message);
    }

    if (!dbSuccess && !sheetsSuccess) {
      return res.status(500).json({ error: "Something went wrong. Please try again." });
    }

    return res.status(200).json({ success: true, message: 'Submitted successfully', db: dbSuccess, sheets: sheetsSuccess });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}

/** Parse "Mar 29" or "Mar 30" style week ending to ISO date string. */
function parseWeekEnding(weekEndingStr) {
  if (!weekEndingStr) return new Date().toISOString().slice(0, 10);
  const months = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
  const parts = weekEndingStr.replace(/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\s+/i, '').trim().split(/\s+/);
  if (parts.length >= 2) {
    const mon = months[parts[0]];
    const day = parseInt(parts[1]);
    if (mon !== undefined && !isNaN(day)) {
      const year = new Date().getFullYear();
      return `${year}-${String(mon + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return weekEndingStr;
}

async function updateProspectStatuses(repName, sections) {
  const allData = await getSheetData(SALES_APP_SHEET_ID, 'Prospects');
  if (allData.length < 2) return;

  const headers = allData[0];
  const nameCol = headers.indexOf('Prospect Name');
  const repCol = headers.indexOf('Rep Name');
  const statusCol = headers.indexOf('Status');
  const updatedCol = headers.indexOf('Last Updated');
  const rankingCol = headers.indexOf('Ranking');
  const nextStepCol = headers.indexOf('Next Step');

  if (nameCol < 0 || repCol < 0 || statusCol < 0) return;

  const now = new Date().toISOString();

  for (const section of sections) {
    const prospects = section.prospects || [];
    for (const prospect of prospects) {
      if (prospect.status !== 'sold' && prospect.status !== 'removed') continue;

      // Find matching row
      for (let r = 1; r < allData.length; r++) {
        if (allData[r][repCol] === repName && allData[r][nameCol] === prospect.name) {
          const rowNum = r + 1; // 1-based

          // Update status
          await updateRange(SALES_APP_SHEET_ID, `Prospects!${colLetter(statusCol)}${rowNum}`, [[prospect.status]]);

          if (updatedCol >= 0) {
            await updateRange(SALES_APP_SHEET_ID, `Prospects!${colLetter(updatedCol)}${rowNum}`, [[now]]);
          }
          if (rankingCol >= 0 && prospect.ranking) {
            await updateRange(SALES_APP_SHEET_ID, `Prospects!${colLetter(rankingCol)}${rowNum}`, [[prospect.ranking]]);
          }
          if (nextStepCol >= 0 && prospect.nextStep) {
            await updateRange(SALES_APP_SHEET_ID, `Prospects!${colLetter(nextStepCol)}${rowNum}`, [[prospect.nextStep]]);
          }
          break;
        }
      }
    }
  }
}

/** Converts 0-based column index to letter (0→A, 25→Z, 26→AA, etc). */
function colLetter(idx) {
  if (idx < 26) return String.fromCharCode(65 + idx);
  return colLetter(Math.floor(idx / 26) - 1) + String.fromCharCode(65 + (idx % 26));
}
// rebuild 1774580449
