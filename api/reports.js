// GET /api/reports?type=weekly-summary&week_ending=YYYY-MM-DD
// Consolidated reporting endpoint (Hobby plan limits to 12 serverless functions)
import { supabase } from './_lib/db.js';
import { getSheetData, getWeekEndingSunday, getCurrentWeekEndingShort, toNum, SALES_APP_SHEET_ID } from './_lib/sheets.js';

export default async function handler(req, res) {
  const type = req.query.type;
  const weekEnding = req.query.week_ending || getWeekEndingSunday().toISOString().slice(0, 10);

  try {
    switch (type) {
      case 'weekly-summary': return await weeklySummary(res, weekEnding);
      case 'non-reporters': return await nonReporters(res, weekEnding);
      case 'rep-activity': return await repActivity(res, req.query);
      case 'division-summary': return await divisionSummary(res, weekEnding);
      case 'lead-summary': return await leadSummary(res, weekEnding);
      case 'trends': return await trends(res, req.query);
      case 'submission-timeline': return await submissionTimeline(res, weekEnding);
      case 'community-detail': return await communityDetail(res, req.query);
      case 'community-results': return await communityResults(res, weekEnding);
      default:
        return res.status(400).json({
          success: false,
          error: 'Missing or invalid "type" parameter',
          valid_types: ['weekly-summary','non-reporters','rep-activity','division-summary','lead-summary','trends','submission-timeline','community-detail'],
        });
    }
  } catch (err) {
    console.error(`[reports/${type}]`, err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function weeklySummary(res, weekEnding) {
  const { data: submissions, error } = await supabase
    .from('weekly_submissions')
    .select('*, reps(name), communities(name, division)')
    .eq('week_ending', weekEnding);
  if (error) throw error;

  const byCommunity = {};
  for (const s of submissions) {
    const key = s.communities.name;
    if (!byCommunity[key]) {
      byCommunity[key] = {
        community: s.communities.name, division: s.communities.division,
        appts_virtual: 0, appts_in_person: 0, total_appts: 0,
        leads_digital: 0, leads_phone: 0, leads_in_person: 0,
        active_prospects: 0, sold: 0, removed: 0, reps_reporting: [],
      };
    }
    const c = byCommunity[key];
    c.appts_virtual += s.appts_virtual; c.appts_in_person += s.appts_in_person;
    c.total_appts += s.total_appts;
    c.leads_digital += s.leads_digital; c.leads_phone += s.leads_phone; c.leads_in_person += s.leads_in_person;
    c.active_prospects += s.active_prospects; c.sold += s.sold_prospects; c.removed += s.removed_prospects;
    c.reps_reporting.push(s.reps.name);
  }

  const { data: assignments } = await supabase
    .from('assignments').select('rep_id, community_id, reps(name), communities(name)').eq('week_ending', weekEnding);
  const submittedKeys = new Set(submissions.map(s => `${s.rep_id}||${s.community_id}`));
  const nr = (assignments || []).filter(a => !submittedKeys.has(`${a.rep_id}||${a.community_id}`))
    .map(a => ({ rep: a.reps.name, community: a.communities.name }));

  return res.status(200).json({
    success: true,
    data: { communities: Object.values(byCommunity), non_reporters: nr,
      summary: { total_submissions: submissions.length, total_communities: Object.keys(byCommunity).length, total_non_reporters: nr.length }},
    meta: { week_ending: weekEnding, generated_at: new Date().toISOString() },
  });
}

async function nonReporters(res, weekEnding) {
  const { data: assignments } = await supabase
    .from('assignments').select('rep_id, community_id, reps(name), communities(name, division)').eq('week_ending', weekEnding);
  const { data: submissions } = await supabase
    .from('weekly_submissions').select('rep_id, community_id').eq('week_ending', weekEnding);
  const keys = new Set((submissions || []).map(s => `${s.rep_id}||${s.community_id}`));
  const nr = (assignments || []).filter(a => !keys.has(`${a.rep_id}||${a.community_id}`))
    .map(a => ({ rep: a.reps.name, community: a.communities.name, division: a.communities.division }));
  return res.status(200).json({ success: true, data: nr, meta: { week_ending: weekEnding, count: nr.length } });
}

async function repActivity(res, query) {
  const repId = query.rep_id;
  if (!repId) return res.status(400).json({ success: false, error: 'rep_id required' });
  const { data, error } = await supabase.from('weekly_submissions')
    .select('*, communities(name, division)').eq('rep_id', repId)
    .order('week_ending', { ascending: false }).limit((parseInt(query.weeks) || 4) * 10);
  if (error) throw error;
  const byWeek = {};
  for (const row of data) { if (!byWeek[row.week_ending]) byWeek[row.week_ending] = []; byWeek[row.week_ending].push(row); }
  return res.status(200).json({ success: true, data: byWeek, meta: { rep_id: repId } });
}

async function divisionSummary(res, weekEnding) {
  const { data, error } = await supabase.from('weekly_submissions')
    .select('*, communities(name, division)').eq('week_ending', weekEnding);
  if (error) throw error;
  const byDiv = {};
  for (const row of data) {
    const div = row.communities.division;
    if (!byDiv[div]) byDiv[div] = { division: div, appts_virtual: 0, appts_in_person: 0, total_appts: 0,
      leads_digital: 0, leads_phone: 0, leads_in_person: 0, active_prospects: 0, sold: 0, communities: new Set(), reps: new Set() };
    const d = byDiv[div];
    d.appts_virtual += row.appts_virtual; d.appts_in_person += row.appts_in_person; d.total_appts += row.total_appts;
    d.leads_digital += row.leads_digital; d.leads_phone += row.leads_phone; d.leads_in_person += row.leads_in_person;
    d.active_prospects += row.active_prospects; d.sold += row.sold_prospects;
    d.communities.add(row.communities.name); d.reps.add(row.rep_id);
  }
  return res.status(200).json({ success: true, data: Object.values(byDiv).map(d => ({ ...d, communities: d.communities.size, reps: d.reps.size })), meta: { week_ending: weekEnding } });
}

async function leadSummary(res, weekEnding) {
  const { data, error } = await supabase.from('leads').select('*, communities(name, division)').eq('week_ending', weekEnding);
  if (error) throw error;
  return res.status(200).json({ success: true, data: (data || []).map(l => ({
    community: l.communities.name, division: l.communities.division,
    digital_leads: l.digital_leads, in_person_leads: l.in_person_leads, call_in_leads: l.call_in_leads,
    total: l.digital_leads + l.in_person_leads + l.call_in_leads,
  })), meta: { week_ending: weekEnding } });
}

async function trends(res, query) {
  const weeks = parseInt(query.weeks) || 8;
  const division = query.division || null;
  const { data, error } = await supabase.from('weekly_submissions')
    .select('week_ending, total_appts, appts_virtual, appts_in_person, leads_digital, leads_phone, leads_in_person, active_prospects, sold_prospects, communities(division)')
    .order('week_ending', { ascending: false });
  if (error) throw error;
  const filtered = division ? data.filter(r => r.communities.division === division) : data;
  const byWeek = {};
  for (const row of filtered) {
    const wk = row.week_ending;
    if (!byWeek[wk]) byWeek[wk] = { week_ending: wk, total_appts: 0, appts_virtual: 0, appts_in_person: 0,
      leads_digital: 0, leads_phone: 0, leads_in_person: 0, active_prospects: 0, sold: 0, submissions: 0 };
    const w = byWeek[wk];
    w.total_appts += row.total_appts; w.appts_virtual += row.appts_virtual; w.appts_in_person += row.appts_in_person;
    w.leads_digital += row.leads_digital; w.leads_phone += row.leads_phone; w.leads_in_person += row.leads_in_person;
    w.active_prospects += row.active_prospects; w.sold += row.sold_prospects; w.submissions += 1;
  }
  return res.status(200).json({ success: true, data: Object.values(byWeek).sort((a, b) => a.week_ending.localeCompare(b.week_ending)).slice(-weeks), meta: { weeks, division } });
}

async function submissionTimeline(res, weekEnding) {
  const { data, error } = await supabase.from('weekly_submissions')
    .select('submitted_at, reps(name), communities(name)').eq('week_ending', weekEnding)
    .order('submitted_at', { ascending: true });
  if (error) throw error;
  return res.status(200).json({ success: true, data: (data || []).map(d => ({ rep: d.reps.name, community: d.communities.name, submitted_at: d.submitted_at })), meta: { week_ending: weekEnding, count: (data || []).length } });
}

async function communityDetail(res, query) {
  const id = query.community_id;
  if (!id) return res.status(400).json({ success: false, error: 'community_id required' });
  const weeks = parseInt(query.weeks) || 4;
  const { data: community } = await supabase.from('communities').select('*').eq('id', id).single();
  if (!community) return res.status(404).json({ success: false, error: 'Community not found' });
  const { data: submissions } = await supabase.from('weekly_submissions').select('*, reps(name)')
    .eq('community_id', id).order('week_ending', { ascending: false }).limit(weeks * 10);
  const { data: prospects } = await supabase.from('prospects').select('*').eq('community_id', id).eq('status', 'active');
  const { data: leads } = await supabase.from('leads').select('*').eq('community_id', id).order('week_ending', { ascending: false }).limit(weeks);
  return res.status(200).json({ success: true, data: { community, submissions, prospects, leads }, meta: { community_id: id, weeks } });
}

/**
 * Community Results — latest week's data by community.
 * Reads from Google Sheets (primary data source during dual-write period)
 * plus prospect details from Sheets. Aggregates by community.
 */
async function communityResults(res, weekEnding) {
  const currentWeekShort = getCurrentWeekEndingShort();

  // 1. Read submissions from Sheets
  const byCommunity = {};
  try {
    const sData = await getSheetData(SALES_APP_SHEET_ID, 'Submissions');
    if (sData.length > 1) {
      const h = sData[0];
      const repIdx = h.indexOf('Rep Name');
      const commIdx = h.indexOf('Community');
      const weekIdx = h.indexOf('Week Ending');
      const tsIdx = h.indexOf('Timestamp');
      const vIdx = h.indexOf('Appts Virtual');
      const ipIdx = h.indexOf('Appts In Person');
      const totIdx = h.indexOf('Total Appts');
      const dlDigIdx = h.indexOf('Direct Leads Digital');
      const dlPhIdx = h.indexOf('Direct Leads Phone Call');
      const dlIPIdx = h.indexOf('Direct Leads In Person');
      const activeIdx = h.indexOf('Active Prospects');
      const soldIdx = h.indexOf('Sold Prospects');

      // Deduplicate: keep latest submission per rep+community for current week
      const latest = {};
      for (let i = 1; i < sData.length; i++) {
        const week = (sData[i][weekIdx] || '').toString().trim();
        if (currentWeekShort && week !== currentWeekShort) continue;
        const rep = (sData[i][repIdx] || '').toString().trim();
        const comm = (sData[i][commIdx] || '').toString().trim();
        const ts = (sData[i][tsIdx] || '').toString();
        const key = `${rep}||${comm}`;
        if (!latest[key] || ts > latest[key].ts) {
          latest[key] = { ts, rep, comm, row: sData[i] };
        }
      }

      for (const { rep, comm, row } of Object.values(latest)) {
        if (!byCommunity[comm]) {
          byCommunity[comm] = {
            community: comm, division: '', reps: [],
            appts_virtual: 0, appts_in_person: 0, total_appts: 0,
            leads_digital: 0, leads_phone: 0, leads_in_person: 0, total_leads: 0,
            active_prospects: 0, sold: 0,
            vip_count: 0, prospect_details: [],
          };
        }
        const c = byCommunity[comm];
        c.reps.push(rep);
        c.appts_virtual += toNum(row[vIdx]);
        c.appts_in_person += toNum(row[ipIdx]);
        c.total_appts += toNum(row[totIdx]);
        c.leads_digital += dlDigIdx >= 0 ? toNum(row[dlDigIdx]) : 0;
        c.leads_phone += dlPhIdx >= 0 ? toNum(row[dlPhIdx]) : 0;
        c.leads_in_person += dlIPIdx >= 0 ? toNum(row[dlIPIdx]) : 0;
        c.total_leads = c.leads_digital + c.leads_phone + c.leads_in_person;
        c.active_prospects += activeIdx >= 0 ? toNum(row[activeIdx]) : 0;
        c.sold += soldIdx >= 0 ? toNum(row[soldIdx]) : 0;
      }
    }
  } catch (e) {
    console.error('[community-results] Submissions read failed:', e.message);
  }

  // 2. Read prospect details from Sheets (for VIP/ranking counts)
  try {
    const pData = await getSheetData(SALES_APP_SHEET_ID, 'Prospects');
    if (pData.length > 1) {
      const h = pData[0];
      const commIdx = h.indexOf('Community');
      const nameIdx = h.indexOf('Prospect Name');
      const rankIdx = h.indexOf('Ranking');
      const statusIdx = h.indexOf('Status');
      const lotIdx = h.indexOf('Lot Number');
      const repIdx = h.indexOf('Rep Name');

      for (let i = 1; i < pData.length; i++) {
        const status = (pData[i][statusIdx] || 'active').toString().toLowerCase();
        if (status !== 'active') continue;
        const comm = (pData[i][commIdx] || '').toString().trim();
        if (!comm) continue;

        if (!byCommunity[comm]) {
          byCommunity[comm] = {
            community: comm, division: '', reps: [],
            appts_virtual: 0, appts_in_person: 0, total_appts: 0,
            leads_digital: 0, leads_phone: 0, leads_in_person: 0, total_leads: 0,
            active_prospects: 0, sold: 0,
            vip_count: 0, prospect_details: [],
          };
        }
        const ranking = (pData[i][rankIdx] || 'C').toString().trim().toUpperCase();
        if (ranking === 'A') byCommunity[comm].vip_count++;

        byCommunity[comm].prospect_details.push({
          name: (pData[i][nameIdx] || '').toString().trim(),
          ranking,
          rep: (pData[i][repIdx] || '').toString().trim(),
          lot: lotIdx >= 0 ? (pData[i][lotIdx] || '').toString().trim() : '',
        });
      }
    }
  } catch (e) {
    console.error('[community-results] Prospects read failed:', e.message);
  }

  // 3. Add division info from DB
  try {
    const { data: comms } = await supabase.from('communities').select('name, division');
    const divMap = Object.fromEntries((comms || []).map(c => [c.name, c.division]));
    for (const c of Object.values(byCommunity)) {
      c.division = divMap[c.community] || '';
    }
  } catch {}

  // Sort by division then community name
  const results = Object.values(byCommunity).sort((a, b) => {
    const d = (a.division || '').localeCompare(b.division || '');
    return d !== 0 ? d : a.community.localeCompare(b.community);
  });

  // Totals
  const totals = results.reduce((t, c) => ({
    total_appts: t.total_appts + c.total_appts,
    total_leads: t.total_leads + c.total_leads,
    active_prospects: t.active_prospects + c.active_prospects,
    sold: t.sold + c.sold,
    vip_count: t.vip_count + c.vip_count,
    communities_reporting: t.communities_reporting + (c.reps.length > 0 ? 1 : 0),
  }), { total_appts: 0, total_leads: 0, active_prospects: 0, sold: 0, vip_count: 0, communities_reporting: 0 });

  return res.status(200).json({
    success: true,
    data: { communities: results, totals },
    meta: { week_ending: currentWeekShort, generated_at: new Date().toISOString(), community_count: results.length },
  });
}
