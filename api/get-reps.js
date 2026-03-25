// GET /api/get-reps — returns sorted unique rep names from Assignments Google Sheet

import { getRepsFromAssignmentsSheet } from './_lib/sync-from-assignments-sheet.js';

export default async function handler(req, res) {
  try {
    const reps = await getRepsFromAssignmentsSheet();
    return res.status(200).json(reps);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
