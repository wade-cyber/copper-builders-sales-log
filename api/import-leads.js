// POST /api/import-leads — Import lead data from OSC Leads Report into Supabase
import { supabase } from './_lib/db.js';
import { getSheetData, getWeekEndingSunday, TEMPLATE_SHEET_ID } from './_lib/sheets.js';
import { resolveOrCreateCommunity, clearResolverCache } from './_lib/resolve-names.js';

export default async function handler(req, res) {
  try {
    clearResolverCache();
    const body = req.method === 'POST' && req.body
      ? (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) : {};

    // Support importing from a specific tab and week ending (for historical imports)
    const weekEnding = body.week_ending || getWeekEndingSunday().toISOString().slice(0, 10);
    const tabName = body.tab || "This Week's Report";

    let oscData;
    try {
      oscData = await getSheetData(TEMPLATE_SHEET_ID, `'${tabName}'!A7:G`);
    } catch {
      oscData = await getSheetData(TEMPLATE_SHEET_ID, "'Dashboard Template'!A7:G");
    }

    if (!oscData || oscData.length === 0) {
      return res.status(200).json({ success: true, message: 'No lead data found', imported: 0 });
    }

    let imported = 0;
    let errors = [];

    for (const row of oscData) {
      const communityName = (row[0] || '').toString().trim();
      if (!communityName) continue;

      // Sheet columns: A=Community, B=Division, C=Digital, D=Phone, E=In-Person, F=Total, G=VIP
      const digital = parseInt(row[2]) || 0;
      const phone = parseInt(row[3]) || 0;
      const inPerson = parseInt(row[4]) || 0;
      const vip = parseInt(row[6]) || 0;

      // Skip rows with no data at all
      if (digital === 0 && phone === 0 && inPerson === 0 && vip === 0) continue;

      try {
        const community = await resolveOrCreateCommunity(communityName);

        const { error } = await supabase.from('leads').upsert({
          community_id: community.id,
          week_ending: weekEnding,
          digital_leads: digital,
          call_in_leads: phone,
          in_person_leads: inPerson,
          notes: vip > 0 ? JSON.stringify({ vip }) : null,
        }, { onConflict: 'community_id,week_ending' });

        if (error) throw error;
        imported++;
      } catch (e) {
        errors.push({ community: communityName, error: e.message });
      }
    }

    // Log the run
    await supabase.from('run_log').insert({
      run_type: 'lead_import',
      status: errors.length > 0 ? 'partial_failure' : 'success',
      completed_at: new Date().toISOString(),
      records_processed: imported,
      errors: errors.length > 0 ? errors : null,
      summary: `Imported ${imported} lead records. ${errors.length} errors.`,
    });

    return res.status(200).json({ success: true, imported, errors: errors.length > 0 ? errors : undefined });
  } catch (err) {
    console.error('[import-leads]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
