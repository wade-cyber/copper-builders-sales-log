// POST /api/save-prospect — write to Supabase
import { supabase } from './_lib/db.js';
import { resolveOrCreateRep, resolveOrCreateCommunity, clearResolverCache } from './_lib/resolve-names.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const now = new Date().toISOString();
    clearResolverCache();

    const rep = await resolveOrCreateRep(data.rep);
    const community = await resolveOrCreateCommunity(data.community);

    await supabase.from('prospects').upsert({
      id: data.id,
      rep_id: rep.id,
      community_id: community.id,
      prospect_name: data.name || null,
      ranking: data.ranking || 'C',
      next_step: data.nextStep || null,
      status: data.status || 'active',
      lot_number: data.lotNumber || null,
      created_date: data.createdDate || now,
      last_updated: now,
    }, { onConflict: 'id' });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[save-prospect]', err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
