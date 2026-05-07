// GET /api/get-prospects?rep=Name — returns active prospects for a rep
import { supabase } from './_lib/db.js';

export default async function handler(req, res) {
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
      createdDate: p.created_date,
      lastUpdated: p.last_updated || p.created_date,
      lastReaffirmedAt: p.last_reaffirmed_at || null,
      lotNumber: p.lot_number || '',
    })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
