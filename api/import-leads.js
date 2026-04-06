// POST /api/import-leads — Import lead data from OSC Leads Report into Supabase
import { supabase } from './_lib/db.js';
import { getWeekEndingSunday } from './_lib/sheets.js';
import { importOSCLeads } from './_lib/import-osc-leads.js';
import { requireAuth } from './_lib/auth.js';

export default async function handler(req, res) {
  const auth = requireAuth(req);
  if (!auth.authorized) return res.status(401).json({ error: auth.error });
  try {
    const body = req.method === 'POST' && req.body
      ? (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) : {};

    const weekEnding = body.week_ending || getWeekEndingSunday().toISOString().slice(0, 10);
    const tabName = body.tab || "This Week's Report";

    const result = await importOSCLeads({ weekEnding, tabName });

    // Log the run
    await supabase.from('run_log').insert({
      run_type: 'lead_import',
      status: result.errors.length > 0 ? 'partial_failure' : 'success',
      completed_at: new Date().toISOString(),
      records_processed: result.imported,
      errors: result.errors.length > 0 ? result.errors : null,
      summary: `Imported ${result.imported} lead records. ${result.errors.length} errors.`,
    });

    return res.status(200).json({ success: true, imported: result.imported, errors: result.errors.length > 0 ? result.errors : undefined });
  } catch (err) {
    console.error('[import-leads]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
