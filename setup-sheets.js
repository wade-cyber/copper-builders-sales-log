/**
 * setup-sheets.js — One-time setup for Google Sheets tabs
 *
 * Run this once with Node to create the 3 tabs in your Google Sheet —
 * or just create them manually.
 *
 * Usage:
 *   1. Enable the Google Sheets API in your Google Cloud project
 *   2. Create a service account (or use OAuth) and download credentials.json
 *   3. Share the Google Sheet with the service account email (Editor access)
 *   4. Run: node setup-sheets.js
 *
 * If you prefer to create the tabs manually, just add these 3 tabs to your
 * "Sales App Reporting" sheet (1WRPxRr6xU2h0lOw20s1NkMk5gk1pgYh_2LNAUcvUxU4)
 * with the header rows shown below:
 *
 * Tab: Assignments
 *   Row 1: Rep Name | Assignment Name | Assignment Type
 *
 * Tab: Submissions
 *   Row 1: Timestamp | Week Ending | Rep Name | Community | Section Type |
 *           Client Only Virtual | Client Only Onsite | Client Only Model |
 *           Realtor+Client Virtual | Realtor+Client Onsite | Realtor+Client Model |
 *           Realtor Only Virtual | Realtor Only Onsite | Realtor Only Model
 *
 * Tab: Prospects
 *   Row 1: ID | Rep Name | Community | Prospect Name | Ranking |
 *           Next Step | Status | Created Date | Last Updated
 */

const SHEET_ID = '1WRPxRr6xU2h0lOw20s1NkMk5gk1pgYh_2LNAUcvUxU4';

const TABS = [
  {
    title: 'Assignments',
    headers: ['Rep Name', 'Assignment Name', 'Assignment Type'],
  },
  {
    title: 'Submissions',
    headers: [
      'Timestamp', 'Week Ending', 'Rep Name', 'Community', 'Section Type',
      'Client Only Virtual', 'Client Only Onsite', 'Client Only Model',
      'Realtor+Client Virtual', 'Realtor+Client Onsite', 'Realtor+Client Model',
      'Realtor Only Virtual', 'Realtor Only Onsite', 'Realtor Only Model',
    ],
  },
  {
    title: 'Prospects',
    headers: [
      'ID', 'Rep Name', 'Community', 'Prospect Name', 'Ranking',
      'Next Step', 'Status', 'Created Date', 'Last Updated',
    ],
  },
];

async function main() {
  let google;
  try {
    ({ google } = await import('googleapis'));
  } catch {
    console.error(
      'googleapis package not installed.\n' +
      'Run: npm install googleapis\n' +
      'Or create the tabs manually — see the header comment in this file for the column layout.'
    );
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: 'credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Get existing sheet tabs
  const { data: spreadsheet } = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    fields: 'sheets.properties.title',
  });
  const existingTabs = spreadsheet.sheets.map((s) => s.properties.title);

  for (const tab of TABS) {
    if (existingTabs.includes(tab.title)) {
      console.log(`Tab "${tab.title}" already exists — skipping creation, writing headers.`);
    } else {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: tab.title } } }],
        },
      });
      console.log(`Created tab "${tab.title}".`);
    }

    // Write header row
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${tab.title}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [tab.headers] },
    });
    console.log(`  → Wrote ${tab.headers.length} header columns.`);
  }

  console.log('\nDone! Your "Sales App Reporting" sheet is ready.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
