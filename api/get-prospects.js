// GET /api/get-prospects?rep=Name — returns active prospects for a rep
import { supabase } from './_lib/db.js';
import { requireAuth } from './_lib/auth.js';

export default async function handler(req, res) {
  const auth = requireAuth(req);
  if (!auth.authorized) return res.status(401).json({ error: auth.error });
  try {
    const rep = req.query.rep || '';
    if (!rep) return res.status(200).json([]);

    const { data: repRow } = await supabase
      .from('reps')
      .select('id')
      .eq('name', rep)
      .single();

    if (!repRow) return res.status(200).json([]);

    const { data: prospects, error } = await supabase
      .from('prospects')
      .select('*, communities(name)')
      .eq('rep_id', repRow.id)
      .eq('status', 'active');

    if (error) throw error;

    return res.status(200).json((prospects || []).map(p => ({
      id: p.id,
      rep,
      community: p.communities.name,
      name: p.prospect_name,
      ranking: p.ranking,
      nextStep: p.next_step || '',
      status: p.status,
      createdDate: p.created_at,
      lastUpdated: p.updated_at || p.created_at,
      lotNumber: p.lot_number || '',
    })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
