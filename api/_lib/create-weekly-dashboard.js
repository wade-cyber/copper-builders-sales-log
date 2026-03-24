// Shared create-weekly-dashboard logic
// Duplicates "Dashboard" tab → next week, clears data, pulls fresh communities,
// renames old Dashboard to archived week name, creates new Dashboard copy.

import {
  getSheetData, updateRange, batchUpdate, getSheetId, getSpreadsheet,
  getCommunityListFromAssignments, logToSystemLog, formatTabName, formatWeekEndingSlash,
  LEADS_SHEET_ID, SALES_APP_SHEET_ID,
} from './sheets.js';

/**
 * Creates the next week's lead dashboard tab.
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

  // Idempotent check — does next week tab already exist?
  const existingId = await getSheetId(LEADS_SHEET_ID, nextTabName);
  if (existingId !== null) {
    return {
      success: true,
      tabName: nextTabName,
      communitiesAdded: 0,
      message: `Tab "${nextTabName}" already exists — skipped`,
    };
  }

  // Find Dashboard tab
  const dashboardSheetId = await getSheetId(LEADS_SHEET_ID, 'Dashboard');
  if (dashboardSheetId === null) {
    return { success: false, message: 'Dashboard tab not found in leads sheet' };
  }

  // Step 1: Duplicate Dashboard → next week tab
  const dupResult = await batchUpdate(LEADS_SHEET_ID, [{
    duplicateSheet: {
      sourceSheetId: dashboardSheetId,
      newSheetName: nextTabName,
    }
  }]);
  const newSheetId = dupResult.data.replies[0].duplicateSheet.properties.sheetId;

  // Step 2: Read current data to determine dimensions
  const sheetMeta = await getSpreadsheet(LEADS_SHEET_ID);
  const newSheetProps = sheetMeta.sheets.find(s => s.properties.sheetId === newSheetId);
  const maxRows = newSheetProps?.properties?.gridProperties?.rowCount || 100;
  const maxCols = newSheetProps?.properties?.gridProperties?.columnCount || 34;

  // Step 3: Update week ending date in A1
  const headerData = await getSheetData(LEADS_SHEET_ID, `'${nextTabName}'!A1`);
  if (headerData.length > 0) {
    const headerVal = (headerData[0][0] || '').toString();
    const datePattern = /Week ending:\s*\S+/i;
    if (datePattern.test(headerVal)) {
      const newHeader = headerVal.replace(datePattern, 'Week ending: ' + nextWeekEnding);
      await updateRange(LEADS_SHEET_ID, `'${nextTabName}'!A1`, [[newHeader]]);
    }
  }

  // Step 4: Clear data cells (cols C+ for rows 3 onwards) and set evergreen zeros
  // Read how many rows exist to know the clear range
  const allData = await getSheetData(LEADS_SHEET_ID, `'${nextTabName}'!A1:AJ${maxRows}`);
  const lastRow = allData.length;

  if (lastRow >= 3) {
    // Clear columns C through end for rows 3+
    const endCol = colLetters(maxCols - 1);
    await updateRange(
      LEADS_SHEET_ID,
      `'${nextTabName}'!C3:${endCol}${lastRow}`,
      Array.from({ length: lastRow - 2 }, () => Array(maxCols - 2).fill(''))
    );
  }

  // Set Total New Leads (col C) to 0 for evergreen rows 3-12
  const evergreenZeros = Array.from({ length: 10 }, () => [0]);
  await updateRange(LEADS_SHEET_ID, `'${nextTabName}'!C3:C12`, evergreenZeros);

  // Step 5: Delete existing community rows (row 13 onwards)
  if (lastRow >= 13) {
    await batchUpdate(LEADS_SHEET_ID, [{
      deleteDimension: {
        range: {
          sheetId: newSheetId,
          dimension: 'ROWS',
          startIndex: 12, // 0-based (row 13)
          endIndex: lastRow,
        }
      }
    }]);
  }

  // Step 6: Pull fresh communities and insert rows
  const communities = await getCommunityListFromAssignments();
  let communitiesAdded = 0;

  if (communities.length > 0) {
    // Insert blank rows after row 12
    await batchUpdate(LEADS_SHEET_ID, [{
      insertDimension: {
        range: {
          sheetId: newSheetId,
          dimension: 'ROWS',
          startIndex: 12,
          endIndex: 12 + communities.length,
        },
        inheritFromBefore: true,
      }
    }]);

    // Copy formatting from row 12 to new rows
    const numCols = maxCols > 0 ? maxCols : 34;
    await batchUpdate(LEADS_SHEET_ID, [{
      copyPaste: {
        source: {
          sheetId: newSheetId,
          startRowIndex: 11, // row 12, 0-based
          endRowIndex: 12,
          startColumnIndex: 0,
          endColumnIndex: numCols,
        },
        destination: {
          sheetId: newSheetId,
          startRowIndex: 12,
          endRowIndex: 12 + communities.length,
          startColumnIndex: 0,
          endColumnIndex: numCols,
        },
        pasteType: 'PASTE_FORMAT',
      }
    }]);

    // Build data rows
    const dataRows = communities.map(c => {
      const row = Array(numCols).fill('');
      row[0] = c.name;   // Col A: Community
      row[1] = c.market;  // Col B: Market
      row[2] = 0;          // Col C: Total New Leads
      return row;
    });

    await updateRange(
      LEADS_SHEET_ID,
      `'${nextTabName}'!A13:${colLetters(numCols - 1)}${12 + communities.length}`,
      dataRows
    );
    communitiesAdded = communities.length;
  }

  // Step 7: Rename current "Dashboard" → archived week name
  await batchUpdate(LEADS_SHEET_ID, [{
    updateSheetProperties: {
      properties: { sheetId: dashboardSheetId, title: currentTabName },
      fields: 'title',
    }
  }]);

  // Step 8: Create new "Dashboard" from next week tab
  const copyResult = await batchUpdate(LEADS_SHEET_ID, [{
    duplicateSheet: {
      sourceSheetId: newSheetId,
      newSheetName: 'Dashboard',
      insertSheetIndex: 0, // first position
    }
  }]);

  await logToSystemLog('createWeeklyDashboard', 'success',
    `Created "${nextTabName}" with ${communitiesAdded} communities`);

  return {
    success: true,
    tabName: nextTabName,
    communitiesAdded,
    message: `Created "${nextTabName}" with ${communitiesAdded} communities. Dashboard ready for next week.`,
  };
}

/** Converts 0-based column index to column letters (0→A, 25→Z, 26→AA, etc). */
function colLetters(idx) {
  let result = '';
  let n = idx;
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}
