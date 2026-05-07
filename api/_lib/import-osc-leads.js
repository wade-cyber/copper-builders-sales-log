// Shared OSC lead import logic — used by both import-leads.js and monday-night.js
import { supabase } from './db.js';
import { getSheetData, getSpreadsheet, getWeekEndingSunday, formatTabName, TEMPLATE_SHEET_ID } from './sheets.js';
import { resolveOrCreateCommunity, clearResolverCache } from './resolve-names.js';

function hasLeadData(rows) {
  if (!rows || rows.length === 0) return false;
  return rows.some(row => {
    const communityName = (row[0] || '').toString().trim();
    if (!communityName) return false;
    return (parseInt(row[2]) || 0) > 0
      || (parseInt(row[3]) || 0) > 0
      || (parseInt(row[4]) || 0) > 0
      || (parseInt(row[6]) || 0) > 0;
  });
}

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

  // Try reading the primary tab ("This Week's Report" or caller-supplied name).
  // If it's empty or missing, fall back to the archived tab for this week_ending —
  // which happens when the cron rotated the sheet before the import ran.
  const primaryTab = tabName || "This Week's Report";
  let oscData = null;
  let sourceTab = primaryTab;

  try {
    oscData = await getSheetData(TEMPLATE_SHEET_ID, `'${primaryTab}'!A7:G`);
  } catch {
    oscData = null;
  }

  if (!hasLeadData(oscData)) {
    // Primary tab is empty or missing — look for the archived tab that was created
    // during rotation. Its name matches formatTabName(week_ending date).
    const [y, m, d] = week.split('-').map(Number);
    const weekDate = new Date(y, m - 1, d);
    const archivedTab = formatTabName(weekDate);

    const spreadsheet = await getSpreadsheet(TEMPLATE_SHEET_ID);
    const tabExists = spreadsheet.sheets.some(s => s.properties.title === archivedTab);

    if (tabExists) {
      oscData = await getSheetData(TEMPLATE_SHEET_ID, `'${archivedTab}'!A7:G`);
      sourceTab = archivedTab;
    }

    if (!hasLeadData(oscData)) {
      throw new Error(
        `No lead data found in "${primaryTab}" or archived tab "${archivedTab}". ` +
        `Make sure OSC has filled in the sheet before importing.`
      );
    }
  }

  let imported = 0;
  const errors = [];

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

  return { success: true, imported, errors, sourceTab };
}
