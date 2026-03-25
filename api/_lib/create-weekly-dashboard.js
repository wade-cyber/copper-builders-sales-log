// Creates the next week's lead dashboard tab in the Copper Leads sheet.
// Uses the new template structure: rows 7-16 evergreen, 17+ communities, cols A-AN.
// Archives current "Dashboard Template" → "Week of [date]", creates fresh template.

import {
  getSheetData, updateRange, batchUpdate, getSheetId, getSpreadsheet,
  logToSystemLog, formatTabName, formatWeekEndingSlash,
  LEADS_SHEET_ID,
} from './sheets.js';
import { getCommunitiesFromAssignmentsSheet } from './sync-from-assignments-sheet.js';

// Total data columns: A(0) through AN(39) = 40 columns
const TOTAL_COLS = 40;
// Evergreen rows occupy rows 7-16 (10 rows). Communities start at row 17.
const EVERGREEN_END_ROW = 16;
const COMMUNITY_START_ROW = 17;

/**
 * Archives the current Dashboard Template and creates a fresh one for next week.
 * Idempotent: skips if next week tab already exists.
 */
export async function createWeeklyDashboard() {
  // Calculate dates
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysToNextSun = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;

  const nextSunday = new Date(today);
  nextSunday.setDate(today.getDate() + daysToNextSun);
  nextSunday.setHours(0, 0, 0, 0);

  const currentSunday = new Date(nextSunday);
  currentSunday.setDate(nextSunday.getDate() - 7);

  const nextTabName = formatTabName(nextSunday);
  const currentTabName = formatTabName(currentSunday);
  const nextWeekEnding = formatWeekEndingSlash(nextSunday);

  // Idempotent check — skip if we already archived this week
  const existingArchive = await getSheetId(LEADS_SHEET_ID, currentTabName);
  if (existingArchive !== null) {
    return {
      success: true,
      tabName: currentTabName,
      communitiesAdded: 0,
      message: `Archive "${currentTabName}" already exists — skipped`,
    };
  }

  // Find Dashboard Template tab
  const dashboardSheetId = await getSheetId(LEADS_SHEET_ID, 'Dashboard Template');
  if (dashboardSheetId === null) {
    return { success: false, message: 'Dashboard Template tab not found in leads sheet' };
  }

  // Step 1: Duplicate Dashboard Template → archive name (current week)
  // This preserves all current data as the archive
  await batchUpdate(LEADS_SHEET_ID, [{
    duplicateSheet: {
      sourceSheetId: dashboardSheetId,
      newSheetName: currentTabName,
    }
  }]);

  // Step 2: Clear all data in Dashboard Template for next week
  // Read current data to know how many rows exist
  const allData = await getSheetData(LEADS_SHEET_ID, `'Dashboard Template'!A1:AN`);
  const lastRow = allData.length;

  // Clear data columns (C through AN) for rows 7+ (all evergreen + community rows)
  if (lastRow >= 7) {
    const clearRows = lastRow - 6;
    await updateRange(
      LEADS_SHEET_ID,
      `'Dashboard Template'!C7:AN${lastRow}`,
      Array.from({ length: clearRows }, () => Array(TOTAL_COLS - 2).fill(0))
    );
  }

  // Update week ending date to next Sunday
  await updateRange(LEADS_SHEET_ID, `'Dashboard Template'!B2`, [[nextWeekEnding]]);

  // Step 3: Sync communities from Assignments sheet
  const communities = await getCommunitiesFromAssignmentsSheet();
  let communitiesAdded = 0;

  // Delete existing community rows (row 17+)
  if (lastRow >= COMMUNITY_START_ROW) {
    await batchUpdate(LEADS_SHEET_ID, [{
      deleteDimension: {
        range: {
          sheetId: dashboardSheetId,
          dimension: 'ROWS',
          startIndex: COMMUNITY_START_ROW - 1, // 0-based
          endIndex: lastRow,
        }
      }
    }]);
  }

  // Insert new community rows
  if (communities.length > 0) {
    // Insert blank rows after row 16
    await batchUpdate(LEADS_SHEET_ID, [{
      insertDimension: {
        range: {
          sheetId: dashboardSheetId,
          dimension: 'ROWS',
          startIndex: COMMUNITY_START_ROW - 1,
          endIndex: COMMUNITY_START_ROW - 1 + communities.length,
        },
        inheritFromBefore: true,
      }
    }]);

    // Copy formatting from row 16 (last evergreen row)
    await batchUpdate(LEADS_SHEET_ID, [{
      copyPaste: {
        source: {
          sheetId: dashboardSheetId,
          startRowIndex: EVERGREEN_END_ROW - 1, // row 16, 0-based = 15
          endRowIndex: EVERGREEN_END_ROW,        // exclusive
          startColumnIndex: 0,
          endColumnIndex: TOTAL_COLS,
        },
        destination: {
          sheetId: dashboardSheetId,
          startRowIndex: COMMUNITY_START_ROW - 1,
          endRowIndex: COMMUNITY_START_ROW - 1 + communities.length,
          startColumnIndex: 0,
          endColumnIndex: TOTAL_COLS,
        },
        pasteType: 'PASTE_FORMAT',
      }
    }]);

    // Write community data
    const dataRows = communities.map(c => {
      const row = Array(TOTAL_COLS).fill(0);
      row[0] = c.name;    // Col A: Community
      row[1] = c.market;  // Col B: Division
      return row;
    });

    await updateRange(
      LEADS_SHEET_ID,
      `'Dashboard Template'!A${COMMUNITY_START_ROW}:AN${COMMUNITY_START_ROW - 1 + communities.length}`,
      dataRows
    );
    communitiesAdded = communities.length;
  }

  await logToSystemLog('createWeeklyDashboard', 'success',
    `Archived "${currentTabName}", prepared next week "${nextTabName}" with ${communitiesAdded} communities`);

  return {
    success: true,
    tabName: currentTabName,
    communitiesAdded,
    message: `Archived "${currentTabName}". Dashboard Template ready for next week (ending ${nextWeekEnding}) with ${communitiesAdded} communities.`,
  };
}
