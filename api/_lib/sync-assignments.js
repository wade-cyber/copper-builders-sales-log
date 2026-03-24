// Shared sync-assignments logic — used by both api/sync-assignments.js and api/sync-smartsheet.js

import {
  getSheetData, updateRange, clearRange, getSheetId, batchUpdate,
  logToSystemLog, SALES_APP_SHEET_ID,
} from './sheets.js';

/**
 * Writes assignments to the Assignments tab, replacing all existing data.
 * @param {Array<{repName, assignmentName, assignmentType, market}>} assignments
 * @returns {{success: boolean, count: number}}
 */
export async function syncAssignments(assignments) {
  // Ensure Assignments tab exists
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
  } else if (existing[0].length < 4 || existing[0][3] !== 'Market') {
    // Upgrade 3-col header to 4-col
    await updateRange(SALES_APP_SHEET_ID, 'Assignments!D1', [['Market']]);
  }

  // Clear everything below header
  const allData = await getSheetData(SALES_APP_SHEET_ID, 'Assignments');
  if (allData.length > 1) {
    const lastRow = allData.length;
    const lastCol = Math.max(allData[0].length, 4);
    const endCol = String.fromCharCode(64 + lastCol);
    await clearRange(SALES_APP_SHEET_ID, `Assignments!A2:${endCol}${lastRow}`);
  }

  // Write new assignments
  if (assignments.length > 0) {
    const rows = assignments.map(a => [
      a.repName,
      a.assignmentName,
      a.assignmentType || 'community',
      a.market || '',
    ]);
    await updateRange(SALES_APP_SHEET_ID, `Assignments!A2:D${1 + rows.length}`, rows);
  }

  // Write sync timestamp to F1:G1
  await updateRange(SALES_APP_SHEET_ID, 'Assignments!F1:G1', [
    ['Last Synced', new Date().toISOString()]
  ]);

  await logToSystemLog('syncAssignments', 'success', `Synced ${assignments.length} assignments`);

  return { success: true, count: assignments.length };
}
