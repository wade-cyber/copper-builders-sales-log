// POST /api/backfill-db — DEPRECATED: migration is complete, Supabase is the single source of truth
export default async function handler(req, res) {
  return res.status(200).json({
    success: true,
    message: 'Backfill is no longer needed — Supabase is the single source of truth. The Sales App Google Sheet is no longer used.',
  });
}
