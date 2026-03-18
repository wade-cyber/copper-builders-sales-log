// sync-smartsheet — Vercel serverless cron function
// Runs every Sunday at 11pm ET (Monday 4:00 UTC) via vercel.json cron config
// Fetches Smartsheet assignments, deduplicates, POSTs to Apps Script syncAssignments

export default async function handler(req, res) {
  const token = process.env.SMARTSHEET_API_TOKEN;
  const sheetId = process.env.SMARTSHEET_SHEET_ID;
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;

  if (!token || !sheetId || !scriptUrl) {
    return res.status(500).json({ error: 'Missing env vars' });
  }

  try {
    // Fetch sheet from Smartsheet API
    const ssRes = await fetch(`https://api.smartsheet.com/2.0/sheets/${sheetId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!ssRes.ok) {
      const text = await ssRes.text();
      return res.status(ssRes.status).json({ error: `Smartsheet API error: ${text}` });
    }

    const sheet = await ssRes.json();

    // Find column indices
    const colMap = {};
    for (const col of sheet.columns) {
      const title = col.title.toLowerCase();
      if (title === 'community/project') colMap.community = col.id;
      else if (title === 'sales counselor') colMap.rep = col.id;
      else if (title === 'sold?') colMap.sold = col.id;
    }

    if (!colMap.community || !colMap.rep) {
      return res.status(500).json({ error: 'Required columns not found in sheet' });
    }

    // Extract assignments, filtering out sold rows
    const rows = [];
    for (const row of sheet.rows) {
      const cells = {};
      for (const cell of row.cells) {
        if (cell.columnId === colMap.community) cells.community = cell.displayValue || cell.value || '';
        if (cell.columnId === colMap.rep) cells.rep = cell.displayValue || cell.value || '';
        if (cell.columnId === colMap.sold) cells.sold = cell.displayValue || cell.value || '';
      }
      if (cells.sold && cells.sold.toLowerCase() === 'yes') continue;
      if (cells.community && cells.rep) {
        rows.push({ community: cells.community.trim(), rep: cells.rep.trim() });
      }
    }

    // Count occurrences of each community name to determine type
    const counts = {};
    for (const r of rows) {
      counts[r.community] = (counts[r.community] || 0) + 1;
    }

    // Deduplicate: one entry per (rep, community)
    const seen = new Set();
    const assignments = [];
    for (const r of rows) {
      const key = `${r.rep}|${r.community}`;
      if (seen.has(key)) continue;
      seen.add(key);
      assignments.push({
        repName: r.rep,
        assignmentName: r.community,
        assignmentType: counts[r.community] > 1 ? 'community' : 'single-home',
      });
    }

    // POST to Apps Script syncAssignments
    const postRes = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'syncAssignments', assignments }),
    });

    if (!postRes.ok) {
      const text = await postRes.text();
      return res.status(500).json({ error: `Apps Script error: ${text}` });
    }

    return res.status(200).json({ success: true, count: assignments.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
