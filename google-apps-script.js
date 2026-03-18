/**
 * Copper Builders — Weekly Sales Log — Google Apps Script Backend
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to https://script.google.com and create a new project
 * 2. Replace the contents of Code.gs with this entire file
 * 3. SHEET_ID is already set below — verify it matches your "Sales App Reporting" sheet
 * 4. Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone
 * 5. Copy the deployment URL into your .env as VITE_GOOGLE_SCRIPT_URL and GOOGLE_SCRIPT_URL
 *
 * Required Google Sheet tabs:
 *   - Assignments (columns: Rep Name, Assignment Name, Assignment Type)
 *   - Submissions (columns: Timestamp, Week Ending, Rep Name, Community, Section Type,
 *                  Client Only Virtual, Client Only Onsite, Client Only Model,
 *                  Realtor+Client Virtual, Realtor+Client Onsite, Realtor+Client Model,
 *                  Realtor Only Virtual, Realtor Only Onsite, Realtor Only Model)
 *   - Prospects (columns: ID, Rep Name, Community, Prospect Name, Ranking,
 *                Next Step, Status, Created Date, Last Updated)
 */

const SHEET_ID = '1WRPxRr6xU2h0lOw20s1NkMk5gk1pgYh_2LNAUcvUxU4';

function getSheet(tabName) {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(tabName);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- GET handlers ---

function doGet(e) {
  const action = e.parameter.action;
  const rep = e.parameter.rep;

  if (action === 'getAssignments') {
    return getAssignments(rep);
  }
  if (action === 'getProspects') {
    return getProspects(rep);
  }

  return jsonResponse({ error: 'Unknown action' });
}

function getAssignments(rep) {
  const sheet = getSheet('Assignments');
  if (!sheet) return jsonResponse([]);

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const results = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const repName = row[headers.indexOf('Rep Name')];
    if (repName !== rep) continue;
    results.push({
      name: row[headers.indexOf('Assignment Name')],
      assignmentName: row[headers.indexOf('Assignment Name')],
      assignmentType: row[headers.indexOf('Assignment Type')] || 'community',
    });
  }

  return jsonResponse(results);
}

function getProspects(rep) {
  const sheet = getSheet('Prospects');
  if (!sheet) return jsonResponse([]);

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const results = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const repName = row[headers.indexOf('Rep Name')];
    if (repName !== rep) continue;
    results.push({
      id: row[headers.indexOf('ID')],
      rep: repName,
      community: row[headers.indexOf('Community')],
      name: row[headers.indexOf('Prospect Name')],
      ranking: row[headers.indexOf('Ranking')],
      nextStep: row[headers.indexOf('Next Step')],
      status: row[headers.indexOf('Status')] || 'active',
      createdDate: row[headers.indexOf('Created Date')],
      lastUpdated: row[headers.indexOf('Last Updated')],
    });
  }

  return jsonResponse(results);
}

// --- POST handlers ---

function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  const action = payload.action;

  if (action === 'submitReport') {
    return handleSubmitReport(payload);
  }
  if (action === 'saveProspect') {
    return handleSaveProspect(payload);
  }
  if (action === 'syncAssignments') {
    return handleSyncAssignments(payload);
  }

  return jsonResponse({ error: 'Unknown action' });
}

function handleSubmitReport(data) {
  const sheet = getSheet('Submissions');
  if (!sheet) return jsonResponse({ error: 'Submissions tab not found' });

  const grid = data.appointments || [[0,0,0],[0,0,0],[0,0,0]];
  sheet.appendRow([
    new Date().toISOString(),
    data.weekEnding,
    data.rep,
    data.community,
    data.sectionType || 'community',
    grid[0][0], grid[0][1], grid[0][2],
    grid[1][0], grid[1][1], grid[1][2],
    grid[2][0], grid[2][1], grid[2][2],
  ]);

  return jsonResponse({ success: true });
}

function handleSaveProspect(data) {
  const sheet = getSheet('Prospects');
  if (!sheet) return jsonResponse({ error: 'Prospects tab not found' });

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('ID');
  const now = new Date().toISOString();

  // Find existing row by ID
  let rowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === data.id) {
      rowIndex = i + 1; // 1-based
      break;
    }
  }

  const rowData = [
    data.id,
    data.rep,
    data.community,
    data.name,
    data.ranking || 'C',
    data.nextStep || '',
    data.status || 'active',
    data.createdDate || now,
    now,
  ];

  if (rowIndex > 0) {
    // Update existing
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    // Insert new
    sheet.appendRow(rowData);
  }

  return jsonResponse({ success: true });
}

function handleSyncAssignments(data) {
  const sheet = getSheet('Assignments');
  if (!sheet) return jsonResponse({ error: 'Assignments tab not found' });

  // Clear everything below the header row
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }

  // Write new assignments
  const assignments = data.assignments || [];
  for (const a of assignments) {
    sheet.appendRow([
      a.repName,
      a.assignmentName,
      a.assignmentType || 'community',
    ]);
  }

  return jsonResponse({ success: true, count: assignments.length });
}
