// GET /api/get-reps — returns sorted unique rep names from persistent assignments
import { supabase } from './_lib/db.js';

export default async function handler(req, res) {
  try {
    const { data, error } = await supabase
      .from('assignments')
      .select('reps(name)');

    if (error) throw error;

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
