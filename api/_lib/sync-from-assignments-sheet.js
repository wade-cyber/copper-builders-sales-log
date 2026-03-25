// Reads rep→community assignments from the Sales Rep Assignments Google Sheet.
// Respects two filter columns:
//   "Sales reporting tool report this week?" = "yes" → included in the rep app
//   "Report Leads this Week?" = "yes" → included on the leads dashboard

import {
  getSheetData, ASSIGNMENTS_SHEET_ID,
} from './sheets.js';

/** Reads and parses all rows from the Assignments sheet with column indices. */
async function readAssignmentsSheet() {
  const data = await getSheetData(ASSIGNMENTS_SHEET_ID, 'Assignments');
  if (data.length < 2) return { headers: data[0] || [], rows: [] };

  const headers = data[0];
  return {
    headers,
    rows: data.slice(1),
    repIdx: headers.indexOf('Rep Name'),
    communityIdx: headers.indexOf('Community Name') >= 0 ? headers.indexOf('Community Name') : headers.indexOf('Community or House Name'),
    divisionIdx: headers.indexOf('Division'),
    reportToolIdx: headers.indexOf('Sales reporting tool report this week?'),
    reportLeadsIdx: headers.indexOf('Report Leads this Week?'),
    thirdPartyIdx: headers.indexOf('3rd Party?'),
    vipIdx: headers.indexOf('VIP List reporting?'),
  };
}

/** Returns true if a cell value is "yes" (case-insensitive). */
function isYes(val) {
  return (val || '').toString().trim().toLowerCase() === 'yes';
}

/**
 * Reads unique communities where "Report Leads this Week?" = "yes".
 * Used by dashboard creation to populate community rows on the leads report.
 * @returns {Array<{name: string, market: string}>}
 */
export async function getCommunitiesForLeadsReport() {
  const { rows, communityIdx, divisionIdx, reportLeadsIdx } = await readAssignmentsSheet();
  if (communityIdx < 0) return [];

  const seen = {};
  const results = [];

  for (const row of rows) {
    if (reportLeadsIdx >= 0 && !isYes(row[reportLeadsIdx])) continue;

    const name = (row[communityIdx] || '').toString().trim();
    if (!name || seen[name]) continue;
    seen[name] = true;

    const market = divisionIdx >= 0 ? (row[divisionIdx] || '').toString().trim() : '';
    results.push({ name, market });
  }

  results.sort((a, b) => {
    const divCmp = a.market.localeCompare(b.market);
    return divCmp !== 0 ? divCmp : a.name.localeCompare(b.name);
  });

  return results;
}

/**
 * Reads unique communities from ALL assignments (regardless of filter).
 * Used by consolidation to build the full Sales Data Results list.
 * @returns {Array<{name: string, market: string}>}
 */
export async function getCommunitiesFromAssignmentsSheet() {
  const { rows, communityIdx, divisionIdx } = await readAssignmentsSheet();
  if (communityIdx < 0) return [];

  const seen = {};
  const results = [];

  for (const row of rows) {
    const name = (row[communityIdx] || '').toString().trim();
    if (!name || seen[name]) continue;
    seen[name] = true;

    const market = divisionIdx >= 0 ? (row[divisionIdx] || '').toString().trim() : '';
    results.push({ name, market });
  }

  results.sort((a, b) => {
    const divCmp = a.market.localeCompare(b.market);
    return divCmp !== 0 ? divCmp : a.name.localeCompare(b.name);
  });

  return results;
}

/**
 * Reads unique rep names who have at least one assignment with
 * "Sales reporting tool report this week?" = "yes".
 * Used by monday-night Phase 1 to determine expected submitters.
 * @returns {string[]}
 */
export async function getRepsFromAssignmentsSheet() {
  const { rows, repIdx, reportToolIdx } = await readAssignmentsSheet();
  if (repIdx < 0) return [];

  const seen = {};
  const results = [];
  for (const row of rows) {
    if (reportToolIdx >= 0 && !isYes(row[reportToolIdx])) continue;

    const name = (row[repIdx] || '').toString().trim();
    if (name && !seen[name]) {
      seen[name] = true;
      results.push(name);
    }
  }
  return results.sort();
}
