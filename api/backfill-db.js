// POST /api/backfill-db — reads Submissions from Google Sheets and inserts into Supabase
import { supabase } from './_lib/db.js';
import { getSheetData, toNum, SALES_APP_SHEET_ID } from './_lib/sheets.js';
import { resolveOrCreateRep, resolveOrCreateCommunity, clearResolverCache } from './_lib/resolve-names.js';

export default async function handler(req, res) {
  try {
    clearResolverCache();
    const sData = await getSheetData(SALES_APP_SHEET_ID, 'Submissions');
    if (sData.length < 2) return res.status(200).json({ success: true, message: 'No submissions to backfill', count: 0 });

    const h = sData[0];
    const tsIdx = h.indexOf('Timestamp');
    const weekIdx = h.indexOf('Week Ending');
    const repIdx = h.indexOf('Rep Name');
    const commIdx = h.indexOf('Community');
    const typeIdx = h.indexOf('Section Type');
    const vIdx = h.indexOf('Appts Virtual');
    const ipIdx = h.indexOf('Appts In Person');
    const totIdx = h.indexOf('Total Appts');
    const dlDigIdx = h.indexOf('Direct Leads Digital');
    const dlPhIdx = h.indexOf('Direct Leads Phone Call');
    const dlIPIdx = h.indexOf('Direct Leads In Person');
    const activeIdx = h.indexOf('Active Prospects');
    const soldIdx = h.indexOf('Sold Prospects');
    const removedIdx = h.indexOf('Removed Prospects');
    const grandIdx = h.indexOf('Grand Total Appts');

    const months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};

    function parseWeek(str) {
      if (!str) return null;
      const cleaned = str.replace(/^(Sunday|Monday)\s+/i, '').trim();
      const parts = cleaned.split(/\s+/);
      if (parts.length >= 2) {
        const mon = months[parts[0]];
        const day = parseInt(parts[1]);
        if (mon !== undefined && !isNaN(day)) {
          return `2026-${String(mon + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
      }
      return null;
    }

    // Deduplicate: keep latest per rep+community+week
    const latest = {};
    for (let i = 1; i < sData.length; i++) {
      const rep = (sData[i][repIdx] || '').toString().trim();
      const comm = (sData[i][commIdx] || '').toString().trim();
      const week = (sData[i][weekIdx] || '').toString().trim();
      const ts = (sData[i][tsIdx] || '').toString();
      if (!rep || !comm || !week) continue;

      const key = `${rep}||${comm}||${week}`;
      if (!latest[key] || ts > latest[key].ts) {
        latest[key] = { ts, row: sData[i], rep, comm, week };
      }
    }

    let inserted = 0;
    let errors = [];

    for (const { row, rep, comm, week } of Object.values(latest)) {
      try {
        const repObj = await resolveOrCreateRep(rep);
        const commObj = await resolveOrCreateCommunity(comm);
        const weekDate = parseWeek(week);
        if (!weekDate) { errors.push(`Bad week: "${week}" for ${rep}/${comm}`); continue; }

        const { error } = await supabase.from('weekly_submissions').upsert({
          rep_id: repObj.id,
          community_id: commObj.id,
          week_ending: weekDate,
          section_type: typeIdx >= 0 ? (row[typeIdx] || null) : null,
          appts_virtual: vIdx >= 0 ? toNum(row[vIdx]) : 0,
          appts_in_person: ipIdx >= 0 ? toNum(row[ipIdx]) : 0,
          total_appts: totIdx >= 0 ? toNum(row[totIdx]) : 0,
          leads_digital: dlDigIdx >= 0 ? toNum(row[dlDigIdx]) : 0,
          leads_phone: dlPhIdx >= 0 ? toNum(row[dlPhIdx]) : 0,
          leads_in_person: dlIPIdx >= 0 ? toNum(row[dlIPIdx]) : 0,
          active_prospects: activeIdx >= 0 ? toNum(row[activeIdx]) : 0,
          sold_prospects: soldIdx >= 0 ? toNum(row[soldIdx]) : 0,
          removed_prospects: removedIdx >= 0 ? toNum(row[removedIdx]) : 0,
          grand_total_appts: grandIdx >= 0 ? toNum(row[grandIdx]) : 0,
          submitted_at: row[tsIdx] || new Date().toISOString(),
        }, { onConflict: 'rep_id,community_id,week_ending' });

        if (error) errors.push(`${rep}/${comm}: ${error.message}`);
        else inserted++;
      } catch (e) {
        errors.push(`${rep}/${comm}: ${e.message}`);
      }
    }

    return res.status(200).json({
      success: true,
      inserted,
      total_rows: Object.keys(latest).length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('[backfill-db]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
