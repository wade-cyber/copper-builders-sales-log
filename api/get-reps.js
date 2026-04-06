// GET /api/get-reps — returns sorted unique rep names from assignments
// Uses current week, falls back to most recent week with data
import { supabase } from './_lib/db.js';
import { getWeekEndingSunday } from './_lib/sheets.js';
import { requireAuth } from './_lib/auth.js';

export default async function handler(req, res) {
  const auth = requireAuth(req);
  if (!auth.authorized) return res.status(401).json({ error: auth.error });
  try {
    const weekEnding = getWeekEndingSunday().toISOString().slice(0, 10);
    let { data, error } = await supabase
      .from('assignments')
      .select('reps(name)')
      .eq('week_ending', weekEnding);

    if (error) throw error;

    // If no assignments for current week, use most recent week
    if (!data || data.length === 0) {
      const { data: latest } = await supabase
        .from('assignments')
        .select('week_ending')
        .order('week_ending', { ascending: false })
        .limit(1)
        .single();

      if (latest) {
        ({ data, error } = await supabase
          .from('assignments')
          .select('reps(name)')
          .eq('week_ending', latest.week_ending));
        if (error) throw error;
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
