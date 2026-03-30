// GET /api/reports/trends?weeks=8&division=CLT
import { supabase } from '../_lib/db.js';

export default async function handler(req, res) {
  const weeks = parseInt(req.query.weeks) || 8;
  const division = req.query.division || null;

  let query = supabase
    .from('weekly_submissions')
    .select('week_ending, total_appts, appts_virtual, appts_in_person, leads_digital, leads_phone, leads_in_person, active_prospects, sold_prospects, communities(division)')
    .order('week_ending', { ascending: false });

  const { data, error } = await query;
  if (error) return res.status(500).json({ success: false, error: error.message });

  // Filter by division if requested
  const filtered = division
    ? data.filter(r => r.communities.division === division)
    : data;

  // Group by week
  const byWeek = {};
  for (const row of filtered) {
    const wk = row.week_ending;
    if (!byWeek[wk]) {
      byWeek[wk] = {
        week_ending: wk, total_appts: 0, appts_virtual: 0, appts_in_person: 0,
        leads_digital: 0, leads_phone: 0, leads_in_person: 0,
        active_prospects: 0, sold: 0, submissions: 0,
      };
    }
    const w = byWeek[wk];
    w.total_appts += row.total_appts;
    w.appts_virtual += row.appts_virtual;
    w.appts_in_person += row.appts_in_person;
    w.leads_digital += row.leads_digital;
    w.leads_phone += row.leads_phone;
    w.leads_in_person += row.leads_in_person;
    w.active_prospects += row.active_prospects;
    w.sold += row.sold_prospects;
    w.submissions += 1;
  }

  const result = Object.values(byWeek)
    .sort((a, b) => a.week_ending.localeCompare(b.week_ending))
    .slice(-weeks);

  return res.status(200).json({
    success: true,
    data: result,
    meta: { weeks, division, generated_at: new Date().toISOString() },
  });
}
