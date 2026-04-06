// GET /api/get-last-sync — returns last sync timestamp from run_log
import { supabase } from './_lib/db.js';
import { requireAuth } from './_lib/auth.js';

export default async function handler(req, res) {
  const auth = requireAuth(req);
  if (!auth.authorized) return res.status(401).json({ error: auth.error });
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
