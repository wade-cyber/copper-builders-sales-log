// GET /api/reports/lead-summary?week_ending=YYYY-MM-DD
import { supabase } from '../_lib/db.js';
import { getWeekEndingSunday } from '../_lib/sheets.js';

export default async function handler(req, res) {
  const weekEnding = req.query.week_ending || getWeekEndingSunday().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('leads')
    .select('*, communities(name, division)')
    .eq('week_ending', weekEnding);

  if (error) return res.status(500).json({ success: false, error: error.message });

  return res.status(200).json({
    success: true,
    data: data.map(l => ({
      community: l.communities.name,
      division: l.communities.division,
      digital_leads: l.digital_leads,
      in_person_leads: l.in_person_leads,
      call_in_leads: l.call_in_leads,
      total: l.digital_leads + l.in_person_leads + l.call_in_leads,
    })),
    meta: { week_ending: weekEnding, record_count: data.length, generated_at: new Date().toISOString() },
  });
}
