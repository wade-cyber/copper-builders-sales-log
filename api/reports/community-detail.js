// GET /api/reports/community-detail?community_id=N&weeks=4
import { supabase } from '../_lib/db.js';

export default async function handler(req, res) {
  const communityId = req.query.community_id;
  const weeks = parseInt(req.query.weeks) || 4;

  if (!communityId) return res.status(400).json({ success: false, error: 'community_id required' });

  const { data: community } = await supabase
    .from('communities')
    .select('*')
    .eq('id', communityId)
    .single();

  if (!community) return res.status(404).json({ success: false, error: 'Community not found' });

  const { data: submissions } = await supabase
    .from('weekly_submissions')
    .select('*, reps(name)')
    .eq('community_id', communityId)
    .order('week_ending', { ascending: false })
    .limit(weeks * 10);

  const { data: prospects } = await supabase
    .from('prospects')
    .select('*')
    .eq('community_id', communityId)
    .eq('status', 'active');

  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('community_id', communityId)
    .order('week_ending', { ascending: false })
    .limit(weeks);

  return res.status(200).json({
    success: true,
    data: { community, submissions, prospects, leads },
    meta: { community_id: communityId, weeks, generated_at: new Date().toISOString() },
  });
}
