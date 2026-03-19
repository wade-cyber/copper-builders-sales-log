// consolidate-dashboard — Vercel serverless function
// Pulls lead data from Copper Leads Dashboard + prospect/appointment data
// from the Sales App, and writes consolidated results to "Sales Data Results" tab.
//
// Trigger manually:
//   POST /api/consolidate-dashboard
//   (no body required)

export default async function handler(req, res) {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;

  if (!scriptUrl) {
    return res.status(500).json({ error: 'Missing GOOGLE_SCRIPT_URL env var' });
  }

  try {
    const postRes = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'consolidateDashboard' }),
    });

    const data = await postRes.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Consolidation failed: ' + err.message });
  }
}
