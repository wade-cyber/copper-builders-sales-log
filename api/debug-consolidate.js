// Temporary debug endpoint — shows community names from both sheets for matching comparison

export default async function handler(req, res) {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (!scriptUrl) return res.status(500).json({ error: 'Missing GOOGLE_SCRIPT_URL' });

  try {
    const postRes = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'debugConsolidate' }),
    });
    const data = await postRes.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
