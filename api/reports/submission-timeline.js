// GET /api/reports/submission-timeline?week_ending=YYYY-MM-DD
import { supabase } from '../_lib/db.js';
import { getWeekEndingSunday } from '../_lib/sheets.js';

export default async function handler(req, res) {
  const weekEnding = req.query.week_ending || getWeekEndingSunday().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('weekly_submissions')
    .select('submitted_at, reps(name), communities(name)')
    .eq('week_ending', weekEnding)
    .order('submitted_at', { ascending: true });

  if (error) return res.status(500).json({ success: false, error: error.message });

  return res.status(200).json({
    success: true,
    data: data.map(d => ({
      rep: d.reps.name,
      community: d.communities.name,
      submitted_at: d.submitted_at,
    })),
    meta: { week_ending: weekEnding, count: data.length, generated_at: new Date().toISOString() },
  });
}
