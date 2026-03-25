// Reads rep→community assignments from the Sales Rep Assignments Google Sheet
// and writes them to the Sales App Reporting → Assignments tab.
// Replaces the Smartsheet-based sync for assignment data.

import {
  getSheetData, updateRange, clearRange, getSheetId, batchUpdate,
  logToSystemLog, SALES_APP_SHEET_ID, ASSIGNMENTS_SHEET_ID,
} from './sheets.js';

/**
 * Syncs assignments from the Sales Rep Assignments Google Sheet
 * into the Sales App Reporting → Assignments tab.
 * @returns {{success: boolean, count: number, reps: string[]}}
 */
export async function syncFromAssignmentsSheet() {
  // Read all rows from the Assignments sheet
  const data = await getSheetData(ASSIGNMENTS_SHEET_ID, 'Assignments');
  if (data.length < 2) {
    return { success: true, count: 0, reps: [] };
  }

  const headers = data[0];
  const repIdx = headers.indexOf('Rep Name');
  const communityIdx = headers.indexOf('Community Name');
  const divisionIdx = headers.indexOf('Division');

  if (repIdx < 0 || communityIdx < 0) {
    throw new Error('Assignments sheet missing required columns (Rep Name, Community Name)');
  }

  // Build assignments list
  const assignments = [];
  const counts = {};

  // First pass: count communities to determine type
  for (let i = 1; i < data.length; i++) {
    const community = (data[i][communityIdx] || '').toString().trim();
    if (community) counts[community] = (counts[community] || 0) + 1;
  }

  // Second pass: build deduplicated assignments
  const seen = new Set();
  for (let i = 1; i < data.length; i++) {
    const rep = (data[i][repIdx] || '').toString().trim();
    const community = (data[i][communityIdx] || '').toString().trim();
    const division = divisionIdx >= 0 ? (data[i][divisionIdx] || '').toString().trim() : '';

    if (!rep || !community) continue;

    const key = `${rep}|${community}`;
    if (seen.has(key)) continue;
    seen.add(key);

    assignments.push({
      repName: rep,
      assignmentName: community,
      assignmentType: counts[community] > 1 ? 'community' : 'single-home',
      market: division,
    });
  }

  // Ensure Assignments tab exists in Sales App
  let sheetId = await getSheetId(SALES_APP_SHEET_ID, 'Assignments');
  if (sheetId === null) {
    await batchUpdate(SALES_APP_SHEET_ID, [{
      addSheet: { properties: { title: 'Assignments' } }
    }]);
  }

  // Check/write header
  const existing = await getSheetData(SALES_APP_SHEET_ID, 'Assignments!A1:D1');
  if (existing.length === 0 || existing[0][0] !== 'Rep Name') {
    await updateRange(SALES_APP_SHEET_ID, 'Assignments!A1:D1', [
      ['Rep Name', 'Assignment Name', 'Assignment Type', 'Market']
    ]);
  }

  // Clear existing data below header
  const allData = await getSheetData(SALES_APP_SHEET_ID, 'Assignments');
  if (allData.length > 1) {
    const lastRow = allData.length;
    await clearRange(SALES_APP_SHEET_ID, `Assignments!A2:D${lastRow}`);
  }

  // Write new assignments
  if (assignments.length > 0) {
    const rows = assignments.map(a => [
      a.repName,
      a.assignmentName,
      a.assignmentType,
      a.market,
    ]);
    await updateRange(SALES_APP_SHEET_ID, `Assignments!A2:D${1 + rows.length}`, rows);
  }

  // Write sync timestamp
  await updateRange(SALES_APP_SHEET_ID, 'Assignments!F1:G1', [
    ['Last Synced', new Date().toISOString()]
  ]);

  // Get unique rep names for return
  const reps = [...new Set(assignments.map(a => a.repName))].sort();

  await logToSystemLog('syncFromAssignmentsSheet', 'success',
    `Synced ${assignments.length} assignments for ${reps.length} reps`);

  return { success: true, count: assignments.length, reps };
}

/**
 * Reads unique communities + divisions from the Assignments Google Sheet.
 * Used by the dashboard creation to populate community rows.
 * @returns {Array<{name: string, market: string}>}
 */
export async function getCommunitiesFromAssignmentsSheet() {
  const data = await getSheetData(ASSIGNMENTS_SHEET_ID, 'Assignments');
  if (data.length < 2) return [];

  const headers = data[0];
  const communityIdx = headers.indexOf('Community Name');
  const divisionIdx = headers.indexOf('Division');
  if (communityIdx < 0) return [];

  const seen = {};
  const results = [];

  for (let i = 1; i < data.length; i++) {
    const name = (data[i][communityIdx] || '').toString().trim();
    if (!name || seen[name]) continue;
    seen[name] = true;

    const market = divisionIdx >= 0 ? (data[i][divisionIdx] || '').toString().trim() : '';
    results.push({ name, market });
  }

  // Sort by division then name
  results.sort((a, b) => {
    const divCmp = a.market.localeCompare(b.market);
    return divCmp !== 0 ? divCmp : a.name.localeCompare(b.name);
  });

  return results;
}

/**
 * Reads unique rep names from the Assignments Google Sheet.
 * @returns {string[]}
 */
export async function getRepsFromAssignmentsSheet() {
  const data = await getSheetData(ASSIGNMENTS_SHEET_ID, 'Assignments');
  if (data.length < 2) return [];

  const headers = data[0];
  const repIdx = headers.indexOf('Rep Name');
  if (repIdx < 0) return [];

  const seen = {};
  const results = [];
  for (let i = 1; i < data.length; i++) {
    const name = (data[i][repIdx] || '').toString().trim();
    if (name && !seen[name]) {
      seen[name] = true;
      results.push(name);
    }
  }
  return results.sort();
}
