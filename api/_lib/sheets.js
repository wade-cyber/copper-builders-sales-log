// Shared Google Sheets helper — service account auth + reusable operations
// Used by all Vercel API routes that interact with Google Sheets.

import { google } from 'googleapis';

// Sheet IDs from environment
export const SALES_APP_SHEET_ID = process.env.SALES_APP_SHEET_ID;
// LEADS_SHEET_ID removed — leads sheet managed separately
export const ASSIGNMENTS_SHEET_ID = process.env.ASSIGNMENTS_SHEET_ID;
export const TEMPLATE_SHEET_ID = process.env.TEMPLATE_SHEET_ID;
// Scorecard data is stored in SALES_APP_SHEET_ID → "Sales Data Results" tab

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

let _authClient = null;

/** Returns an authenticated Google JWT client (cached per cold start). */
export function getAuth() {
  if (_authClient) return _authClient;

  _authClient = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return _authClient;
}

/** Returns an authorized Sheets API v4 client. */
export function getSheetsClient() {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

/** Reads a range and returns a 2D array of values. */
export async function getSheetData(spreadsheetId, range) {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return res.data.values || [];
}

/** Writes values to a specific range (overwrites). */
export async function updateRange(spreadsheetId, range, values) {
  const sheets = getSheetsClient();
  return sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

/** Appends rows to the end of a sheet tab. */
export async function appendRows(spreadsheetId, sheetName, rows) {
  const sheets = getSheetsClient();
  return sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });
}

/** Clears content in a range. */
export async function clearRange(spreadsheetId, range) {
  const sheets = getSheetsClient();
  return sheets.spreadsheets.values.clear({
    spreadsheetId,
    range,
    requestBody: {},
  });
}

/** Executes a batch update (structural operations: duplicate, rename, delete rows, etc). */
export async function batchUpdate(spreadsheetId, requests) {
  const sheets = getSheetsClient();
  return sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
}

/** Returns spreadsheet metadata including sheet names and IDs. */
export async function getSpreadsheet(spreadsheetId) {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties',
  });
  return res.data;
}

/** Finds a sheet's numeric ID by tab name. Returns null if not found. */
export async function getSheetId(spreadsheetId, sheetName) {
  const data = await getSpreadsheet(spreadsheetId);
  const match = data.sheets.find(s => s.properties.title === sheetName);
  return match ? match.properties.sheetId : null;
}

/** Safely converts a value to a number. Returns 0 for blanks/NaN. */
export function toNum(val) {
  if (val === '' || val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

/** Formats a Date as "Week of Mar 29, 2026" for tab names. */
export function formatTabName(d) {
  return 'Week of ' + MONTHS_SHORT[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

/** Formats a Date as "3/29/2026" for the "Week ending:" cell. */
export function formatWeekEndingSlash(d) {
  return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
}

/** Returns the current week-ending date in short format (e.g. "Mar 22"). */
export function getCurrentWeekEndingShort() {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  const sun = new Date(today);
  sun.setDate(today.getDate() + diff);
  return MONTHS_SHORT[sun.getMonth()] + ' ' + sun.getDate();
}

/** Reads unique communities (type=community) from the Assignments tab. Returns [{name, market}]. */
export async function getCommunityListFromAssignments() {
  const data = await getSheetData(SALES_APP_SHEET_ID, 'Assignments');
  if (data.length < 2) return [];

  const headers = data[0];
  const nameIdx = headers.indexOf('Assignment Name');
  const typeIdx = headers.indexOf('Assignment Type');
  const marketIdx = headers.indexOf('Market');
  if (nameIdx < 0) return [];

  const seen = {};
  const results = [];

  for (let i = 1; i < data.length; i++) {
    const type = (data[i][typeIdx] || '').toString().toLowerCase().replace('-', '');
    if (type !== 'community') continue;

    const name = (data[i][nameIdx] || '').toString().trim();
    if (!name || seen[name]) continue;
    seen[name] = true;

    const market = marketIdx >= 0 ? (data[i][marketIdx] || '').toString().trim() : '';
    results.push({ name, market });
  }

  results.sort((a, b) => a.name.localeCompare(b.name));
  return results;
}

/** Reads unique rep names from the Assignments tab. Returns sorted string array. */
export async function getUniqueRepsFromAssignments() {
  const data = await getSheetData(SALES_APP_SHEET_ID, 'Assignments');
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
  results.sort();
  return results;
}

/** Appends a log entry to the "System Log" tab. Auto-creates if missing. */
export async function logToSystemLog(action, status, message) {
  try {
    const sheets = getSheetsClient();

    // Check if System Log tab exists
    const sheetId = await getSheetId(SALES_APP_SHEET_ID, 'System Log');
    if (sheetId === null) {
      // Create tab
      await batchUpdate(SALES_APP_SHEET_ID, [{
        addSheet: { properties: { title: 'System Log' } }
      }]);
      // Write header
      await updateRange(SALES_APP_SHEET_ID, 'System Log!A1:D1', [
        ['Timestamp', 'Action', 'Status', 'Message']
      ]);
    }

    await appendRows(SALES_APP_SHEET_ID, 'System Log', [
      [new Date().toISOString(), action, status, message]
    ]);
  } catch (e) {
    // Logging should never break the main operation
    console.error('System log write failed:', e.message);
  }
}
