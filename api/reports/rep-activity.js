// GET /api/reports/rep-activity?rep_id=N&weeks=4
import { supabase } from '../_lib/db.js';

export default async function handler(req, res) {
  const repId = req.query.rep_id;
  const weeks = parseInt(req.query.weeks) || 4;

  if (!repId) return res.status(400).json({ success: false, error: 'rep_id required' });

  const { data, error } = await supabase
    .from('weekly_submissions')
    .select('*, communities(name, division)')
    .eq('rep_id', repId)
    .order('week_ending', { ascending: false })
    .limit(weeks * 10);

  if (error) return res.status(500).json({ success: false, error: error.message });

  // Group by week
  const byWeek = {};
  for (const row of data) {
    const wk = row.week_ending;
    if (!byWeek[wk]) byWeek[wk] = [];
    byWeek[wk].push(row);
  }

  return res.status(200).json({
    success: true,
    data: byWeek,
    meta: { rep_id: repId, weeks, record_count: data.length, generated_at: new Date().toISOString() },
  });
}
