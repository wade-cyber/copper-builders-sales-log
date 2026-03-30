// GET /api/reports/weekly-summary?week_ending=YYYY-MM-DD
import { supabase } from '../_lib/db.js';
import { getWeekEndingSunday } from '../_lib/sheets.js';

export default async function handler(req, res) {
  const weekEnding = req.query.week_ending || getWeekEndingSunday().toISOString().slice(0, 10);

  // Submissions by community
  const { data: submissions, error: subErr } = await supabase
    .from('weekly_submissions')
    .select(`
      *,
      reps(name),
      communities(name, division)
    `)
    .eq('week_ending', weekEnding);

  if (subErr) return res.status(500).json({ success: false, error: subErr.message });

  // Aggregate by community
  const byCommunity = {};
  for (const s of submissions) {
    const key = s.communities.name;
    if (!byCommunity[key]) {
      byCommunity[key] = {
        community: s.communities.name,
        division: s.communities.division,
        total_appts_virtual: 0, total_appts_in_person: 0, total_appts: 0,
        total_leads_digital: 0, total_leads_phone: 0, total_leads_in_person: 0,
        total_active_prospects: 0, total_sold: 0, total_removed: 0,
        reps_reporting: [],
      };
    }
    const c = byCommunity[key];
    c.total_appts_virtual += s.appts_virtual;
    c.total_appts_in_person += s.appts_in_person;
    c.total_appts += s.total_appts;
    c.total_leads_digital += s.leads_digital;
    c.total_leads_phone += s.leads_phone;
    c.total_leads_in_person += s.leads_in_person;
    c.total_active_prospects += s.active_prospects;
    c.total_sold += s.sold_prospects;
    c.total_removed += s.removed_prospects;
    c.reps_reporting.push(s.reps.name);
  }

  // Non-reporters
  const { data: assignments } = await supabase
    .from('assignments')
    .select('rep_id, community_id, reps(name), communities(name)')
    .eq('week_ending', weekEnding);

  const submittedKeys = new Set(submissions.map(s => `${s.rep_id}||${s.community_id}`));
  const nonReporters = (assignments || [])
    .filter(a => !submittedKeys.has(`${a.rep_id}||${a.community_id}`))
    .map(a => ({ rep: a.reps.name, community: a.communities.name }));

  return res.status(200).json({
    success: true,
    data: {
      communities: Object.values(byCommunity),
      non_reporters: nonReporters,
      summary: {
        total_submissions: submissions.length,
        total_communities: Object.keys(byCommunity).length,
        total_non_reporters: nonReporters.length,
      },
    },
    meta: { week_ending: weekEnding, generated_at: new Date().toISOString() },
  });
}
