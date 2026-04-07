// Shared OSC lead import logic — used by both import-leads.js and monday-night.js
import { supabase } from './db.js';
import { getSheetData, getWeekEndingSunday, TEMPLATE_SHEET_ID } from './sheets.js';
import { resolveOrCreateCommunity, clearResolverCache } from './resolve-names.js';

export async function importOSCLeads({ weekEnding, tabName } = {}) {
  clearResolverCache();

  // Default to the previous Sunday (the week the OSC data is for).
  // On Monday the cron runs, getWeekEndingSunday() returns next Sunday,
  // but the OSC sheet contains last week's data.
  let week = weekEnding;
  if (!week) {
    const currentSunday = getWeekEndingSunday();
    const prevSunday = new Date(currentSunday);
    prevSunday.setDate(currentSunday.getDate() - 7);
    week = prevSunday.toISOString().slice(0, 10);
  }
  const tab = tabName || "This Week's Report";

  let oscData;
  try {
    oscData = await getSheetData(TEMPLATE_SHEET_ID, `'${tab}'!A7:G`);
  } catch {
    oscData = await getSheetData(TEMPLATE_SHEET_ID, "'Dashboard Template'!A7:G");
  }

  if (!oscData || oscData.length === 0) {
    return { success: true, imported: 0, errors: [] };
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

    if (digital === 0 && phone === 0 && inPerson === 0 && vip === 0) continue;

    try {
      const community = await resolveOrCreateCommunity(communityName);

      const { error } = await supabase.from('leads').upsert({
        community_id: community.id,
        week_ending: week,
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

  return { success: true, imported, errors };
}
