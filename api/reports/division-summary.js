// GET /api/reports/division-summary?week_ending=YYYY-MM-DD
import { supabase } from '../_lib/db.js';
import { getWeekEndingSunday } from '../_lib/sheets.js';

export default async function handler(req, res) {
  const weekEnding = req.query.week_ending || getWeekEndingSunday().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('weekly_submissions')
    .select('*, communities(name, division)')
    .eq('week_ending', weekEnding);

  if (error) return res.status(500).json({ success: false, error: error.message });

  const byDiv = {};
  for (const row of data) {
    const div = row.communities.division;
    if (!byDiv[div]) {
      byDiv[div] = {
        division: div, appts_virtual: 0, appts_in_person: 0, total_appts: 0,
        leads_digital: 0, leads_phone: 0, leads_in_person: 0,
        active_prospects: 0, sold: 0, communities: new Set(), reps: new Set(),
      };
    }
    const d = byDiv[div];
    d.appts_virtual += row.appts_virtual;
    d.appts_in_person += row.appts_in_person;
    d.total_appts += row.total_appts;
    d.leads_digital += row.leads_digital;
    d.leads_phone += row.leads_phone;
    d.leads_in_person += row.leads_in_person;
    d.active_prospects += row.active_prospects;
    d.sold += row.sold_prospects;
    d.communities.add(row.communities.name);
    d.reps.add(row.rep_id);
  }

  const result = Object.values(byDiv).map(d => ({
    ...d,
    communities: d.communities.size,
    reps: d.reps.size,
  }));

  return res.status(200).json({
    success: true,
    data: result,
    meta: { week_ending: weekEnding, generated_at: new Date().toISOString() },
  });
}
