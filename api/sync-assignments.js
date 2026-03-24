// POST /api/sync-assignments — overwrite Assignments tab with new data

import { syncAssignments } from './_lib/sync-assignments.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const result = await syncAssignments(data.assignments || []);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
