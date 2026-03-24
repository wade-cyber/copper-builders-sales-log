// POST /api/create-weekly-dashboard — creates next week's lead dashboard tab

import { createWeeklyDashboard } from './_lib/create-weekly-dashboard.js';

export default async function handler(req, res) {
  try {
    const result = await createWeeklyDashboard();
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
