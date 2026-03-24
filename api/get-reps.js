// GET /api/get-reps — returns sorted unique rep names from Assignments tab

import { getUniqueRepsFromAssignments } from './_lib/sheets.js';

export default async function handler(req, res) {
  try {
    const reps = await getUniqueRepsFromAssignments();
    return res.status(200).json(reps);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
