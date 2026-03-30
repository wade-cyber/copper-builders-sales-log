// POST /api/import-leads — Import lead data from OSC Leads Report into Supabase
import { supabase } from './_lib/db.js';
import { getSheetData, getWeekEndingSunday, TEMPLATE_SHEET_ID } from './_lib/sheets.js';
import { resolveOrCreateCommunity, clearResolverCache } from './_lib/resolve-names.js';

export default async function handler(req, res) {
  try {
    clearResolverCache();
    const weekEnding = getWeekEndingSunday().toISOString().slice(0, 10);

    // Read from "This Week's Report" tab (the active weekly OSC tab)
    const REPORT_TAB = "This Week's Report";
    let oscData;
    try {
      oscData = await getSheetData(TEMPLATE_SHEET_ID, `'${REPORT_TAB}'!A7:F`);
    } catch {
      // Fall back to Dashboard Template if This Week's Report doesn't exist yet
      oscData = await getSheetData(TEMPLATE_SHEET_ID, "'Dashboard Template'!A7:F");
    }

    if (!oscData || oscData.length === 0) {
      return res.status(200).json({ success: true, message: 'No lead data found', imported: 0 });
    }

    let imported = 0;
    let errors = [];

    for (const row of oscData) {
      const communityName = (row[0] || '').toString().trim();
      if (!communityName) continue;

      const digital = parseInt(row[2]) || 0;
      const inPerson = parseInt(row[3]) || 0;
      const callIn = parseInt(row[4]) || 0;

      // Skip rows with no data
      if (digital === 0 && inPerson === 0 && callIn === 0) continue;

      try {
        const community = await resolveOrCreateCommunity(communityName);

        const { error } = await supabase.from('leads').upsert({
          community_id: community.id,
          week_ending: weekEnding,
          digital_leads: digital,
          in_person_leads: inPerson,
          call_in_leads: callIn,
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
