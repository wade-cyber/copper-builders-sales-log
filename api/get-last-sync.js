// GET /api/get-last-sync — returns last sync timestamp from run_log
import { supabase } from './_lib/db.js';

export default async function handler(req, res) {
  try {
    const { data } = await supabase
      .from('run_log')
      .select('completed_at')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    return res.status(200).json({
      lastSynced: data?.completed_at || null,
    });
  } catch (err) {
    return res.status(200).json({ lastSynced: null });
  }
}
