// GET /api/reports/non-reporters?week_ending=YYYY-MM-DD
import { supabase } from '../_lib/db.js';
import { getWeekEndingSunday } from '../_lib/sheets.js';

export default async function handler(req, res) {
  const weekEnding = req.query.week_ending || getWeekEndingSunday().toISOString().slice(0, 10);

  const { data: assignments } = await supabase
    .from('assignments')
    .select('rep_id, community_id, reps(name), communities(name, division)')
    .eq('week_ending', weekEnding);

  const { data: submissions } = await supabase
    .from('weekly_submissions')
    .select('rep_id, community_id')
    .eq('week_ending', weekEnding);

  const submittedKeys = new Set((submissions || []).map(s => `${s.rep_id}||${s.community_id}`));
  const nonReporters = (assignments || [])
    .filter(a => !submittedKeys.has(`${a.rep_id}||${a.community_id}`))
    .map(a => ({ rep: a.reps.name, community: a.communities.name, division: a.communities.division }));

  return res.status(200).json({
    success: true,
    data: nonReporters,
    meta: { week_ending: weekEnding, count: nonReporters.length, generated_at: new Date().toISOString() },
  });
}
