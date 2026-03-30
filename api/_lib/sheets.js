// Shared Google Sheets helper — lightweight, uses google-auth-library + fetch
// instead of the heavy googleapis package for faster cold starts on Vercel.

import { GoogleAuth } from 'google-auth-library';

export const SALES_APP_SHEET_ID = process.env.SALES_APP_SHEET_ID;
export const ASSIGNMENTS_SHEET_ID = process.env.ASSIGNMENTS_SHEET_ID;
export const TEMPLATE_SHEET_ID = process.env.TEMPLATE_SHEET_ID;

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

let _auth = null;

async function getAccessToken() {
  if (!_auth) {
    _auth = new GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }
  const client = await _auth.getClient();
  const { token } = await client.getAccessToken();
  return token;
}

async function sheetsGet(url) {
  const token = await getAccessToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function sheetsPost(url, body) {
  const token = await getAccessToken();
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function sheetsPut(url, body) {
  const token = await getAccessToken();
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Reads a range and returns a 2D array of values. */
export async function getSheetData(spreadsheetId, range) {
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const data = await sheetsGet(url);
  return data.values || [];
}

/** Writes values to a specific range (overwrites). */
export async function updateRange(spreadsheetId, range, values) {
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  return sheetsPut(url, { values });
}

/** Appends rows to the end of a sheet tab. */
export async function appendRows(spreadsheetId, sheetName, rows) {
  const range = encodeURIComponent(`${sheetName}!A1`);
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  return sheetsPost(url, { values: rows });
}

/** Clears content in a range. */
export async function clearRange(spreadsheetId, range) {
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`;
  return sheetsPost(url, {});
}

/** Executes a batch update (structural operations). */
export async function batchUpdate(spreadsheetId, requests) {
  const url = `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`;
  return sheetsPost(url, { requests });
}

/** Returns spreadsheet metadata including sheet names and IDs. */
export async function getSpreadsheet(spreadsheetId) {
  const url = `${SHEETS_BASE}/${spreadsheetId}?fields=sheets.properties`;
  return sheetsGet(url);
}

/** Finds a sheet's numeric ID by tab name. Returns null if not found. */
export async function getSheetId(spreadsheetId, sheetName) {
  const data = await getSpreadsheet(spreadsheetId);
  const match = data.sheets.find(s => s.properties.title === sheetName);
  return match ? match.properties.sheetId : null;
}

/**
 * Returns current date/time in Eastern Time as a Date object.
 * Handles EST/EDT automatically.
 */
export function nowET() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const get = (type) => parts.find(p => p.type === type).value;
  return new Date(
    `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`
  );
}

export function toNum(val) {
  if (val === '' || val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

export function formatTabName(d) {
  return 'Week of ' + MONTHS_SHORT[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

export function formatWeekEndingSlash(d) {
  return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
}

/**
 * Returns the Sunday that ends the current business week.
 * If today IS Sunday, returns today. If Mon-Sat, returns the upcoming Sunday.
 * @param {Date|string|null} referenceDate - optional date to calculate from
 * @returns {Date}
 */
export function getWeekEndingSunday(referenceDate = null) {
  const date = referenceDate ? new Date(referenceDate) : nowET();
  const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysUntilSunday = dayOfWeek === 0 ? 0 : (7 - dayOfWeek);
  const sunday = new Date(date);
  sunday.setDate(date.getDate() + daysUntilSunday);
  return sunday;
}

export function getCurrentWeekEndingShort(referenceDate = null) {
  const sun = getWeekEndingSunday(referenceDate);
  return MONTHS_SHORT[sun.getMonth()] + ' ' + sun.getDate();
}

export async function logToSystemLog(action, status, message) {
  try {
    const sheetId = await getSheetId(SALES_APP_SHEET_ID, 'System Log');
    if (sheetId === null) {
      await batchUpdate(SALES_APP_SHEET_ID, [{
        addSheet: { properties: { title: 'System Log' } }
      }]);
      await updateRange(SALES_APP_SHEET_ID, 'System Log!A1:D1', [
        ['Timestamp', 'Action', 'Status', 'Message']
      ]);
    }
    await appendRows(SALES_APP_SHEET_ID, 'System Log', [
      [new Date().toISOString(), action, status, message]
    ]);
  } catch (e) {
    console.error('System log write failed:', e.message);
  }
}
