// GET /api/get-reps — returns sorted unique rep names from current week's assignments
import { supabase } from './_lib/db.js';
import { getWeekEndingSunday } from './_lib/sheets.js';

export default async function handler(req, res) {
  try {
    const weekEnding = getWeekEndingSunday().toISOString().slice(0, 10);

    let { data, error } = await supabase
      .from('assignments')
      .select('reps(name)')
      .eq('week_ending', weekEnding);
    if (error) throw error;

    // Fallback to most recent week if cron hasn't run yet for this week
    if (!data || data.length === 0) {
      const { data: recent, error: rErr } = await supabase
        .from('assignments')
        .select('reps(name), week_ending')
        .not('week_ending', 'is', null)
        .order('week_ending', { ascending: false })
        .limit(200);
      if (rErr) throw rErr;
      const mostRecent = recent?.[0]?.week_ending;
      data = mostRecent ? recent.filter(a => a.week_ending === mostRecent) : [];

      // Last resort: NULL-week legacy rows
      if (data.length === 0) {
        const { data: legacy } = await supabase.from('assignments').select('reps(name)').is('week_ending', null);
        data = legacy || [];
      }
    }

    const names = [...new Set((data || []).map(a => a.reps.name))]
      .filter(n => {
        const lower = n.toLowerCase();
        return lower !== 'n/a' && lower !== 'none' && lower !== 'na';
      })
      .sort();

    return res.status(200).json(names);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
