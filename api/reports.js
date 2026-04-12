// GET /api/reports?type=weekly-summary&week_ending=YYYY-MM-DD
// Consolidated reporting endpoint (Hobby plan limits to 12 serverless functions)
import { supabase } from './_lib/db.js';
import { getWeekEndingSunday } from './_lib/sheets.js';

export default async function handler(req, res) {
  const type = req.query.type;
  // Default to the most recently completed week (previous Sunday).
  // This flips to the new week on Monday at 12:00 AM ET.
  const currentSunday = getWeekEndingSunday();
  const prevSunday = new Date(currentSunday);
  prevSunday.setDate(currentSunday.getDate() - 7);
  const weekEnding = req.query.week_ending || prevSunday.toISOString().slice(0, 10);

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
    .from('assignments').select('rep_id, community_id, reps(name), communities(name)');
  // Also check next week's submissions to catch late reporters (frontend tags them with the following Sunday)
  const nw = new Date(weekEnding + 'T00:00:00');
  nw.setDate(nw.getDate() + 7);
  const { data: nextWeekSubs } = await supabase
    .from('weekly_submissions').select('rep_id, community_id').eq('week_ending', nw.toISOString().slice(0, 10));
  const submittedKeys = new Set([
    ...submissions.map(s => `${s.rep_id}||${s.community_id}`),
    ...(nextWeekSubs || []).map(s => `${s.rep_id}||${s.community_id}`),
  ]);
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
    .from('assignments').select('rep_id, community_id, reps(name), communities(name, division)');
  const { data: submissions } = await supabase
    .from('weekly_submissions').select('rep_id, community_id').eq('week_ending', weekEnding);
  // Also check next week's submissions to catch late reporters (frontend tags them with the following Sunday)
  const nw = new Date(weekEnding + 'T00:00:00');
  nw.setDate(nw.getDate() + 7);
  const { data: nextWeekSubs } = await supabase
    .from('weekly_submissions').select('rep_id, community_id').eq('week_ending', nw.toISOString().slice(0, 10));
  const keys = new Set([
    ...(submissions || []).map(s => `${s.rep_id}||${s.community_id}`),
    ...(nextWeekSubs || []).map(s => `${s.rep_id}||${s.community_id}`),
  ]);
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
 * Community Results — weekly data by community from the database.
 * Supports week_ending parameter for navigating between weeks.
 * Also returns available weeks for the week picker.
 */
async function communityResults(res, weekEnding) {
  // Get available weeks for navigation
  const { data: weekRows } = await supabase
    .from('weekly_submissions')
    .select('week_ending')
    .order('week_ending', { ascending: false });
  const availableWeeks = [...new Set((weekRows || []).map(r => r.week_ending))];

  // If no specific week requested, use the most recent with data (or current)
  const targetWeek = availableWeeks.includes(weekEnding) ? weekEnding : (availableWeeks[0] || weekEnding);

  // 0. Seed from persistent assignments so all assigned communities + reps appear
  const { data: assignments } = await supabase
    .from('assignments')
    .select('reps(name), communities(name, division)');

  const byCommunity = {};
  for (const a of (assignments || [])) {
    const comm = a.communities.name;
    if (!byCommunity[comm]) {
      byCommunity[comm] = {
        community: comm, division: a.communities.division, reps: [],
        appts_virtual: 0, appts_in_person: 0, total_appts: 0,
        leads_digital: 0, leads_phone: 0, leads_in_person: 0, total_leads: 0,
        active_prospects: 0, sold: 0,
        vip_count: 0, prospect_details: [],
      };
    }
    const repName = a.reps.name;
    if (!byCommunity[comm].reps.includes(repName)) {
      byCommunity[comm].reps.push(repName);
    }
  }

  // 1. Read submissions from DB and layer on top
  const { data: submissions } = await supabase
    .from('weekly_submissions')
    .select('*, reps(name), communities(name, division)')
    .eq('week_ending', targetWeek);

  for (const s of (submissions || [])) {
    const comm = s.communities.name;
    if (!byCommunity[comm]) {
      byCommunity[comm] = {
        community: comm, division: s.communities.division, reps: [],
        appts_virtual: 0, appts_in_person: 0, total_appts: 0,
        leads_digital: 0, leads_phone: 0, leads_in_person: 0, total_leads: 0,
        active_prospects: 0, sold: 0,
        vip_count: 0, prospect_details: [],
      };
    }
    const c = byCommunity[comm];
    if (!c.reps.includes(s.reps.name)) c.reps.push(s.reps.name);
    c.appts_virtual += s.appts_virtual;
    c.appts_in_person += s.appts_in_person;
    c.total_appts += s.total_appts;
    c.leads_digital += s.leads_digital;
    c.leads_phone += s.leads_phone;
    c.leads_in_person += s.leads_in_person;
    c.total_leads = c.leads_digital + c.leads_phone + c.leads_in_person;
    c.active_prospects += s.active_prospects;
    c.sold += s.sold_prospects;
  }

  // Track which communities have at least one submission for this week
  const submittedCommunities = new Set((submissions || []).map(s => s.communities.name));
  for (const comm of Object.keys(byCommunity)) {
    byCommunity[comm].submitted = submittedCommunities.has(comm);
  }

  // 2. Read prospect details from DB (active prospects with rankings)
  const { data: prospects } = await supabase
    .from('prospects')
    .select('*, reps(name), communities(name)')
    .eq('status', 'active');

  for (const p of (prospects || [])) {
    const comm = p.communities.name;
    if (!byCommunity[comm]) {
      byCommunity[comm] = {
        community: comm, division: '', reps: [],
        appts_virtual: 0, appts_in_person: 0, total_appts: 0,
        leads_digital: 0, leads_phone: 0, leads_in_person: 0, total_leads: 0,
        active_prospects: 0, sold: 0,
        vip_count: 0, prospect_details: [],
      };
    }
    const ranking = (p.ranking || 'C').toUpperCase();
    if (ranking === 'A') byCommunity[comm].vip_count++;
    byCommunity[comm].prospect_details.push({
      name: p.prospect_name || '',
      ranking,
      rep: p.reps.name,
      lot: p.lot_number || '',
    });
  }

  // Add division for prospect-only communities
  const { data: allComms } = await supabase.from('communities').select('name, division');
  const divMap = Object.fromEntries((allComms || []).map(c => [c.name, c.division]));
  for (const c of Object.values(byCommunity)) {
    if (!c.division) c.division = divMap[c.community] || '';
  }

  // Sort by division then community name
  const results = Object.values(byCommunity).sort((a, b) => {
    const d = (a.division || '').localeCompare(b.division || '');
    return d !== 0 ? d : a.community.localeCompare(b.community);
  });

  // 3. Add OSC marketing leads + VIP count from the leads table
  const { data: oscLeads } = await supabase
    .from('leads')
    .select('community_id, digital_leads, in_person_leads, call_in_leads, notes, communities(name)')
    .eq('week_ending', targetWeek);

  let oscLeadTotal = 0;
  let oscCommunityCount = 0;
  let oscVipTotal = 0;
  for (const l of (oscLeads || [])) {
    const commName = l.communities.name;
    const total = l.digital_leads + l.in_person_leads + l.call_in_leads;
    const vip = l.notes ? (JSON.parse(l.notes).vip || 0) : 0;
    oscLeadTotal += total;
    oscVipTotal += vip;
    if (total > 0) oscCommunityCount++;
    if (byCommunity[commName]) {
      byCommunity[commName].osc_leads = total;
      byCommunity[commName].osc_vips = vip;
    }
  }

  const totals = results.reduce((t, c) => ({
    total_appts: t.total_appts + c.total_appts,
    total_leads: t.total_leads + c.total_leads,
    active_prospects: t.active_prospects + c.active_prospects,
    sold: t.sold + c.sold,
    communities_reporting: t.communities_reporting + (c.reps.length > 0 ? 1 : 0),
  }), { total_appts: 0, total_leads: 0, active_prospects: 0, sold: 0, communities_reporting: 0 });

  totals.osc_leads = oscLeadTotal;
  totals.osc_communities = oscCommunityCount;
  totals.osc_vips = oscVipTotal;

  // Non-reporters: assigned reps who have zero submissions for the entire week.
  // Also check the NEXT week's submissions to catch late reporters — the frontend
  // uses nextSunday() so reps who submit after Sunday get tagged to the following week.
  const { data: nrAssignments } = await supabase
    .from('assignments')
    .select('rep_id, reps(name)');

  const nextWeek = new Date(targetWeek + 'T00:00:00');
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().slice(0, 10);
  const { data: nextWeekSubs } = await supabase
    .from('weekly_submissions')
    .select('rep_id')
    .eq('week_ending', nextWeekStr);

  const repsWhoSubmitted = new Set([
    ...(submissions || []).map(s => s.rep_id),
    ...(nextWeekSubs || []).map(s => s.rep_id),
  ]);
  const assignedRepNames = [...new Map((nrAssignments || []).map(a => [a.rep_id, a.reps.name])).values()];
  const nonReporters = assignedRepNames
    .filter(name => {
      const repId = (nrAssignments || []).find(a => a.reps.name === name)?.rep_id;
      return repId && !repsWhoSubmitted.has(repId);
    })
    .sort();

  // Last submission per rep (most recent across all weeks)
  const { data: allSubs } = await supabase
    .from('weekly_submissions')
    .select('rep_id, submitted_at, reps(name)')
    .order('submitted_at', { ascending: false });

  const lastByRep = {};
  for (const s of (allSubs || [])) {
    if (!lastByRep[s.rep_id]) {
      lastByRep[s.rep_id] = { rep: s.reps.name, submitted_at: s.submitted_at };
    }
  }
  const repLastSubmissions = Object.values(lastByRep).sort((a, b) => a.rep.localeCompare(b.rep));

  return res.status(200).json({
    success: true,
    data: { communities: results, totals, non_reporters: nonReporters, available_weeks: availableWeeks, rep_last_submissions: repLastSubmissions },
    meta: { week_ending: targetWeek, generated_at: new Date().toISOString(), community_count: results.length },
  });
}
