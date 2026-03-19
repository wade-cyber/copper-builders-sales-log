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
 * Required Google Sheet tabs (Sales App):
 *   - Assignments (columns: Rep Name, Assignment Name, Assignment Type, Market)
 *   - Submissions (columns: Timestamp, Week Ending, Rep Name, Community, Section Type, ...)
 *   - Prospects (columns: ID, Rep Name, Community, Prospect Name, Ranking,
 *                Next Step, Status, Created Date, Last Updated)
 *
 * Required Google Sheet tabs (Copper Leads):
 *   - Dashboard (the active week template)
 */

var SHEET_ID = '1WRPxRr6xU2h0lOw20s1NkMk5gk1pgYh_2LNAUcvUxU4';
var LEADS_SHEET_ID = '1eH15Te0Wd1nuMMQ-yL0bvtxuYKAcPLv33CYjYylNEeI';
var RESULTS_SHEET_ID = '1az7HktTLeeQCcCV5f5hgPDyRElyJKzezZymgywc6Gzw';

var MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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
  var action = e.parameter.action;
  var rep = e.parameter.rep;

  if (action === 'getAssignments') {
    return getAssignments(rep);
  }
  if (action === 'getProspects') {
    return getProspects(rep);
  }
  if (action === 'getLastSync') {
    return getLastSync();
  }

  return jsonResponse({ error: 'Unknown action' });
}

function getAssignments(rep) {
  var sheet = getSheet('Assignments');
  if (!sheet) return jsonResponse([]);

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var results = [];

  // When no rep provided, return all unique community names
  if (!rep) {
    var seen = {};
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var assignmentName = row[headers.indexOf('Assignment Name')];
      var assignmentType = (row[headers.indexOf('Assignment Type')] || 'community').toLowerCase();
      if (assignmentType === 'community' && !seen[assignmentName]) {
        seen[assignmentName] = true;
        results.push({ name: assignmentName, assignmentName: assignmentName, assignmentType: 'community' });
      }
    }
    return jsonResponse(results);
  }

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var repName = row[headers.indexOf('Rep Name')];
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
  var sheet = getSheet('Prospects');
  if (!sheet) return jsonResponse([]);

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var results = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var repName = row[headers.indexOf('Rep Name')];
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

function getLastSync() {
  var sheet = getSheet('Assignments');
  if (!sheet) return jsonResponse({ lastSynced: null });
  var val = sheet.getRange('G1').getValue();
  return jsonResponse({ lastSynced: val ? new Date(val).toISOString() : null });
}

// --- POST handlers ---

function doPost(e) {
  var payload = JSON.parse(e.postData.contents);
  var action = payload.action;

  if (action === 'submitReport') {
    return handleSubmitReport(payload);
  }
  if (action === 'submitWeeklyLog') {
    return handleSubmitWeeklyLog(payload);
  }
  if (action === 'saveProspect') {
    return handleSaveProspect(payload);
  }
  if (action === 'syncAssignments') {
    return handleSyncAssignments(payload);
  }
  if (action === 'createWeeklyDashboard') {
    return jsonResponse(handleCreateWeeklyDashboard());
  }
  if (action === 'consolidateDashboard') {
    return jsonResponse(handleConsolidateDashboard());
  }
  if (action === 'debugConsolidate') {
    return jsonResponse(debugConsolidateNames_());
  }

  return jsonResponse({ error: 'Unknown action' });
}

// ══════════════════════════════════════════════════════════════
// WEEKLY LEAD DASHBOARD — createWeeklyDashboard
// ══════════════════════════════════════════════════════════════

/**
 * Creates the next week's lead dashboard tab.
 *
 * 1. Duplicates "Dashboard" tab → "Week of Mar 29, 2026"
 * 2. Clears all data, updates date, pulls fresh communities
 * 3. Renames current "Dashboard" → "Week of Mar 22, 2026"
 * 4. Creates new "Dashboard" as copy of next week tab, moves to first position
 *
 * Idempotent: skips if next week tab already exists.
 */
function handleCreateWeeklyDashboard() {
  // ── Calculate dates ──
  var today = new Date();
  var dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...
  var daysToNextSun = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;

  var nextSunday = new Date(today);
  nextSunday.setDate(today.getDate() + daysToNextSun);
  nextSunday.setHours(0, 0, 0, 0);

  var currentSunday = new Date(nextSunday);
  currentSunday.setDate(nextSunday.getDate() - 7);

  var nextTabName = formatTabName_(nextSunday);
  var currentTabName = formatTabName_(currentSunday);
  var nextWeekEnding = formatWeekEndingSlash_(nextSunday);

  // ── Open the leads spreadsheet ──
  var leadsSpreadsheet = SpreadsheetApp.openById(LEADS_SHEET_ID);

  // ── Idempotent check ──
  if (leadsSpreadsheet.getSheetByName(nextTabName)) {
    return {
      success: true,
      tabName: nextTabName,
      communitiesAdded: 0,
      message: 'Tab "' + nextTabName + '" already exists — skipped'
    };
  }

  // ── Find Dashboard tab ──
  var dashboardSheet = leadsSpreadsheet.getSheetByName('Dashboard');
  if (!dashboardSheet) {
    return { success: false, message: 'Dashboard tab not found in leads sheet' };
  }

  // ── Step 3: Duplicate Dashboard → next week tab ──
  var newSheet = dashboardSheet.copyTo(leadsSpreadsheet);
  newSheet.setName(nextTabName);

  // ── Step 4a: Update week ending date ──
  newSheet.getRange('A3').setValue('Week ending: ' + nextWeekEnding);

  // ── Step 4b: Clear data cells ──
  var lastRow = newSheet.getLastRow();
  var lastCol = newSheet.getLastColumn();

  // Clear columns C through last col for rows 9 onwards (all data)
  if (lastRow >= 9 && lastCol >= 3) {
    newSheet.getRange(9, 3, lastRow - 8, lastCol - 2).clearContent();
  }

  // Set Total New Leads (col C) to 0 for evergreen rows 9-18
  var evergreenZeros = [];
  for (var r = 0; r < 10; r++) {
    evergreenZeros.push([0]);
  }
  newSheet.getRange(9, 3, 10, 1).setValues(evergreenZeros);

  // ── Step 4c: Delete existing community rows (row 20 onwards) ──
  // Refresh lastRow after clearing
  lastRow = newSheet.getLastRow();
  if (lastRow >= 20) {
    newSheet.deleteRows(20, lastRow - 19);
  }

  // ── Step 4d: Pull fresh communities from Assignments tab ──
  var communities = getCommunityListFromAssignments_();

  // ── Step 4e: Write community rows starting at row 20 ──
  var communitiesAdded = 0;
  if (communities.length > 0) {
    // Insert blank rows after the "Communities" header (row 19)
    newSheet.insertRowsAfter(19, communities.length);

    // Copy formatting from row 18 (last evergreen row) to all new rows
    var numCols = lastCol > 0 ? lastCol : 33;
    newSheet.getRange(18, 1, 1, numCols)
      .copyFormatToRange(newSheet, 1, numCols, 20, 19 + communities.length);

    // Build data array
    var dataRows = [];
    for (var c = 0; c < communities.length; c++) {
      var row = [];
      for (var col = 0; col < numCols; col++) {
        row.push('');
      }
      row[0] = communities[c].name;    // Col A: Community
      row[1] = communities[c].market;  // Col B: Market
      row[2] = 0;                       // Col C: Total New Leads
      dataRows.push(row);
    }

    newSheet.getRange(20, 1, communities.length, numCols).setValues(dataRows);
    communitiesAdded = communities.length;
  }

  // ── Step 5: Rename current "Dashboard" → archived week name ──
  dashboardSheet.setName(currentTabName);

  // ── Step 6: Create new "Dashboard" from next week tab ──
  var newDashboard = newSheet.copyTo(leadsSpreadsheet);
  newDashboard.setName('Dashboard');

  // Move Dashboard to first position (leftmost tab)
  leadsSpreadsheet.setActiveSheet(newDashboard);
  leadsSpreadsheet.moveActiveSheet(1);

  logToSystemLog_('createWeeklyDashboard', 'success', 'Created "' + nextTabName + '" with ' + communitiesAdded + ' communities');

  return {
    success: true,
    tabName: nextTabName,
    communitiesAdded: communitiesAdded,
    message: 'Created "' + nextTabName + '" with ' + communitiesAdded + ' communities. Dashboard ready for next week.'
  };
}

/**
 * Reads unique communities (type=community) from the Assignments tab
 * in the Sales App Google Sheet. Returns [{name, market}, ...].
 */
function getCommunityListFromAssignments_() {
  var salesSpreadsheet = SpreadsheetApp.openById(SHEET_ID);
  var assignSheet = salesSpreadsheet.getSheetByName('Assignments');
  if (!assignSheet) return [];

  var data = assignSheet.getDataRange().getValues();
  if (data.length < 2) return [];

  var headers = data[0];
  var nameIdx = headers.indexOf('Assignment Name');
  var typeIdx = headers.indexOf('Assignment Type');
  var marketIdx = headers.indexOf('Market');

  if (nameIdx < 0) return [];

  var seen = {};
  var results = [];

  for (var i = 1; i < data.length; i++) {
    var type = (data[i][typeIdx] || '').toString().toLowerCase().replace('-', '');
    if (type !== 'community') continue;

    var name = (data[i][nameIdx] || '').toString().trim();
    if (!name || seen[name]) continue;
    seen[name] = true;

    var market = '';
    if (marketIdx >= 0) {
      market = (data[i][marketIdx] || '').toString().trim();
    }

    results.push({ name: name, market: market });
  }

  // Sort alphabetically by name
  results.sort(function(a, b) {
    return a.name.localeCompare(b.name);
  });

  return results;
}

/**
 * Formats a Date as "Week of Mar 29, 2026" for tab names.
 */
function formatTabName_(d) {
  return 'Week of ' + MONTHS_SHORT[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

/**
 * Formats a Date as "3/29/2026" for the "Week ending:" cell.
 */
function formatWeekEndingSlash_(d) {
  return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
}


// ══════════════════════════════════════════════════════════════
// SUBMIT WEEKLY LOG
// ══════════════════════════════════════════════════════════════

function handleSubmitWeeklyLog(data) {
  var sheet = getSheet('Submissions');
  if (!sheet) {
    sheet = SpreadsheetApp.openById(SHEET_ID).insertSheet('Submissions');
  }

  // Ensure header row
  var firstCell = sheet.getRange(1, 1).getValue();
  if (firstCell !== 'Timestamp') {
    sheet.getRange(1, 1, 1, 20).setValues([[
      'Timestamp', 'Week Ending', 'Rep Name', 'Community', 'Section Type',
      'Client Only Virtual', 'Client Only Onsite', 'Client Only Model',
      'Realtor+Client Virtual', 'Realtor+Client Onsite', 'Realtor+Client Model',
      'Realtor Only Virtual', 'Realtor Only Onsite', 'Realtor Only Model',
      'Total Appts', 'Active Prospects', 'Sold Prospects', 'Removed Prospects',
      'Grand Total Appts', 'Grand Total Prospects'
    ]]);
  }

  var sections = data.sections || [];
  for (var i = 0; i < sections.length; i++) {
    var section = sections[i];
    var appts = section.appointments || {};
    var co = appts.clientOnly || {};
    var rc = appts.realtorPlusClient || {};
    var ro = appts.realtorOnly || {};
    var prospects = section.prospects || [];

    sheet.appendRow([
      data.timestamp,
      data.weekEnding,
      data.repName,
      section.name,
      section.type,
      co.virtual || 0,
      co.onsite || 0,
      co.model || 0,
      rc.virtual || 0,
      rc.onsite || 0,
      rc.model || 0,
      ro.virtual || 0,
      ro.onsite || 0,
      ro.model || 0,
      section.totalAppointments || 0,
      prospects.filter(function(p) { return p.status === 'active'; }).length,
      prospects.filter(function(p) { return p.status === 'sold'; }).length,
      prospects.filter(function(p) { return p.status === 'removed'; }).length,
      (data.totals || {}).totalAppointments || 0,
      (data.totals || {}).totalProspects || 0
    ]);
  }

  // Update prospect statuses in the Prospects tab
  updateProspectStatuses(data.repName, sections);

  return jsonResponse({ success: true, message: 'Submitted successfully' });
}

function updateProspectStatuses(repName, sections) {
  var sheet = getSheet('Prospects');
  if (!sheet) return;

  var allData = sheet.getDataRange().getValues();
  if (allData.length < 2) return;

  var headers = allData[0];
  var nameCol = headers.indexOf('Prospect Name');
  var repCol = headers.indexOf('Rep Name');
  var statusCol = headers.indexOf('Status');
  var updatedCol = headers.indexOf('Last Updated');
  var rankingCol = headers.indexOf('Ranking');
  var nextStepCol = headers.indexOf('Next Step');

  if (nameCol < 0 || repCol < 0 || statusCol < 0) return;

  var now = new Date().toISOString();

  for (var s = 0; s < sections.length; s++) {
    var prospects = sections[s].prospects || [];
    for (var p = 0; p < prospects.length; p++) {
      var prospect = prospects[p];
      if (prospect.status !== 'sold' && prospect.status !== 'removed') continue;

      // Find matching row
      for (var r = 1; r < allData.length; r++) {
        if (allData[r][repCol] === repName && allData[r][nameCol] === prospect.name) {
          var rowNum = r + 1; // 1-based
          sheet.getRange(rowNum, statusCol + 1).setValue(prospect.status);
          if (updatedCol >= 0) {
            sheet.getRange(rowNum, updatedCol + 1).setValue(now);
          }
          if (rankingCol >= 0 && prospect.ranking) {
            sheet.getRange(rowNum, rankingCol + 1).setValue(prospect.ranking);
          }
          if (nextStepCol >= 0 && prospect.nextStep) {
            sheet.getRange(rowNum, nextStepCol + 1).setValue(prospect.nextStep);
          }
          break;
        }
      }
    }
  }
}


// ══════════════════════════════════════════════════════════════
// LEGACY SUBMIT REPORT (per-block)
// ══════════════════════════════════════════════════════════════

function handleSubmitReport(data) {
  var sheet = getSheet('Submissions');
  if (!sheet) {
    sheet = SpreadsheetApp.openById(SHEET_ID).insertSheet('Submissions');
  }
  var firstCell = sheet.getRange(1, 1).getValue();
  if (firstCell !== 'Timestamp') {
    sheet.getRange(1, 1, 1, 14).setValues([[
      'Timestamp', 'Week Ending', 'Rep Name', 'Community', 'Section Type',
      'Client Only Virtual', 'Client Only Onsite', 'Client Only Model',
      'Realtor+Client Virtual', 'Realtor+Client Onsite', 'Realtor+Client Model',
      'Realtor Only Virtual', 'Realtor Only Onsite', 'Realtor Only Model'
    ]]);
  }

  var grid = data.appointments || [[0,0,0],[0,0,0],[0,0,0]];
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


// ══════════════════════════════════════════════════════════════
// SAVE PROSPECT
// ══════════════════════════════════════════════════════════════

function handleSaveProspect(data) {
  var sheet = getSheet('Prospects');
  if (!sheet) {
    sheet = SpreadsheetApp.openById(SHEET_ID).insertSheet('Prospects');
  }
  var firstCell = sheet.getRange(1, 1).getValue();
  if (firstCell !== 'ID') {
    sheet.getRange(1, 1, 1, 9).setValues([[
      'ID', 'Rep Name', 'Community', 'Prospect Name', 'Ranking',
      'Next Step', 'Status', 'Created Date', 'Last Updated'
    ]]);
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol = headers.indexOf('ID');
  var now = new Date().toISOString();

  // Find existing row by ID
  var rowIndex = -1;
  for (var i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === data.id) {
      rowIndex = i + 1; // 1-based
      break;
    }
  }

  var rowData = [
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
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  return jsonResponse({ success: true });
}


// ══════════════════════════════════════════════════════════════
// SYNC ASSIGNMENTS
// ══════════════════════════════════════════════════════════════

function handleSyncAssignments(data) {
  var sheet = getSheet('Assignments');
  if (!sheet) {
    sheet = SpreadsheetApp.openById(SHEET_ID).insertSheet('Assignments');
  }

  // Ensure header row (4 columns now — added Market)
  var firstCell = sheet.getRange(1, 1).getValue();
  if (firstCell !== 'Rep Name') {
    sheet.getRange(1, 1, 1, 4).setValues([['Rep Name', 'Assignment Name', 'Assignment Type', 'Market']]);
  } else {
    // Upgrade existing 3-col header to 4-col if needed
    var fourthHeader = sheet.getRange(1, 4).getValue();
    if (fourthHeader !== 'Market') {
      sheet.getRange(1, 4).setValue('Market');
    }
  }

  // Clear everything below the header row
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }

  // Write new assignments
  var assignments = data.assignments || [];
  if (assignments.length > 0) {
    var rows = [];
    for (var i = 0; i < assignments.length; i++) {
      var a = assignments[i];
      rows.push([
        a.repName,
        a.assignmentName,
        a.assignmentType || 'community',
        a.market || ''
      ]);
    }
    sheet.getRange(2, 1, rows.length, 4).setValues(rows);
  }

  // Write sync timestamp to F1:G1 (after the 4 data columns + gap)
  sheet.getRange('F1').setValue('Last Synced');
  sheet.getRange('G1').setValue(new Date().toISOString());

  logToSystemLog_('syncAssignments', 'success', 'Synced ' + assignments.length + ' assignments');

  return jsonResponse({ success: true, count: assignments.length });
}


// ══════════════════════════════════════════════════════════════
// CONSOLIDATE DASHBOARD
// ══════════════════════════════════════════════════════════════
//
// Reads lead data from Copper Leads "Dashboard" tab,
// prospect counts and appointment totals from the Sales App,
// and writes consolidated values to "Sales Data Results" tab.
//
// Target columns in Sales Data Results:
//   C: Active Prospects    (from Prospects tab)
//   D: Appointments Held   (from Submissions tab)
//   E: Total New Leads     (from Copper Leads col F)
//   G: Digital Leads       (from Copper Leads cols G-P)
//   H: In-Person Leads     (from Copper Leads cols Q-AA)
//   J: Call Leads           (from Copper Leads cols AB-AH)
//   L: VIP List Signups    (from Copper Leads col AI)
//
// Matching: by community name (col A), case-insensitive.
// ══════════════════════════════════════════════════════════════

function handleConsolidateDashboard() {
  // ── 1. Read Copper Leads Dashboard ──
  var leadsSheet = SpreadsheetApp.openById(LEADS_SHEET_ID).getSheetByName('Dashboard');
  if (!leadsSheet) {
    return { success: false, message: 'Copper Leads "Dashboard" tab not found' };
  }

  var leadsLastRow = leadsSheet.getLastRow();
  var leadsLastCol = leadsSheet.getLastColumn();
  if (leadsLastRow < 9) {
    return { success: false, message: 'Copper Leads Dashboard has no data rows' };
  }

  // Read rows 9 onwards (all data rows: evergreen + communities)
  var leadsDataRows = leadsLastRow - 8; // rows 9 to lastRow
  var leadsData = leadsSheet.getRange(9, 1, leadsDataRows, Math.max(leadsLastCol, 35)).getValues();

  // Build lookup: community name (lowercase) → lead metrics
  var leadsByCommunity = {};
  for (var i = 0; i < leadsData.length; i++) {
    var communityName = (leadsData[i][0] || '').toString().trim();
    if (!communityName) continue;

    // Col F (idx 5): Total New Leads
    var totalNewLeads = toNum_(leadsData[i][5]);

    // Cols G-P (idx 6-15): Digital leads — 10 columns
    var digitalLeads = 0;
    for (var d = 6; d <= 15; d++) {
      digitalLeads += toNum_(leadsData[i][d]);
    }

    // Cols Q-AA (idx 16-26): In Person leads — 11 columns
    var inPersonLeads = 0;
    for (var p = 16; p <= 26; p++) {
      inPersonLeads += toNum_(leadsData[i][p]);
    }

    // Cols AB-AH (idx 27-33): Call leads — 7 columns
    // Safe approach: read everything between In Person (26) and VIP col AI (34)
    var callLeads = 0;
    for (var c = 27; c <= 33; c++) {
      callLeads += toNum_(leadsData[i][c]);
    }

    // Col AI (idx 34): VIP List Total Signups
    var vipListSignups = toNum_(leadsData[i][34]);

    leadsByCommunity[communityName.toLowerCase()] = {
      totalNewLeads: totalNewLeads,
      digitalLeads: digitalLeads,
      inPersonLeads: inPersonLeads,
      callLeads: callLeads,
      vipListSignups: vipListSignups
    };
  }

  // ── 2. Count active prospects per community (from Sales App) ──
  var prospectCounts = {};
  var prospectsSheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Prospects');
  if (prospectsSheet && prospectsSheet.getLastRow() > 1) {
    var pData = prospectsSheet.getDataRange().getValues();
    var pHeaders = pData[0];
    var pCommunityIdx = pHeaders.indexOf('Community');
    var pStatusIdx = pHeaders.indexOf('Status');

    if (pCommunityIdx >= 0 && pStatusIdx >= 0) {
      for (var i = 1; i < pData.length; i++) {
        var status = (pData[i][pStatusIdx] || 'active').toString().toLowerCase();
        if (status !== 'active') continue;
        var comm = (pData[i][pCommunityIdx] || '').toString().trim().toLowerCase();
        if (comm) prospectCounts[comm] = (prospectCounts[comm] || 0) + 1;
      }
    }
  }

  // ── 3. Sum appointments held per community (from Sales App Submissions) ──
  var apptCounts = {};
  var submissionsSheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Submissions');
  if (submissionsSheet && submissionsSheet.getLastRow() > 1) {
    var sData = submissionsSheet.getDataRange().getValues();
    var sHeaders = sData[0];
    var sCommunityIdx = sHeaders.indexOf('Community');
    var sApptsIdx = sHeaders.indexOf('Total Appts');
    var sWeekIdx = sHeaders.indexOf('Week Ending');

    if (sCommunityIdx >= 0 && sApptsIdx >= 0) {
      // Determine current week ending for filtering
      var currentWeekEnding = getCurrentWeekEndingShort_();

      for (var i = 1; i < sData.length; i++) {
        // Filter to current week only
        var weekVal = (sData[i][sWeekIdx] || '').toString().trim();
        if (sWeekIdx >= 0 && currentWeekEnding && weekVal !== currentWeekEnding) continue;

        var comm = (sData[i][sCommunityIdx] || '').toString().trim().toLowerCase();
        var appts = toNum_(sData[i][sApptsIdx]);
        if (comm) apptCounts[comm] = (apptCounts[comm] || 0) + appts;
      }
    }
  }

  // ── 4. Write to Sales Data Results ──
  var resultsSpreadsheet = SpreadsheetApp.openById(RESULTS_SHEET_ID);
  var resultsSheet = resultsSpreadsheet.getSheetByName('Sales Data Results');
  if (!resultsSheet) {
    return { success: false, message: '"Sales Data Results" tab not found in results sheet' };
  }

  // ── 4a. Dynamic community row rebuild from Assignments ──
  // Keep rows 1-11 (headers/static), clear rows 12+ and rewrite from Assignments
  var lastRow = resultsSheet.getLastRow();
  if (lastRow >= 12) {
    resultsSheet.getRange(12, 1, lastRow - 11, resultsSheet.getLastColumn()).clearContent();
  }

  var communities = getCommunityListFromAssignments_();
  if (communities.length > 0) {
    var communityRows = [];
    for (var ci = 0; ci < communities.length; ci++) {
      communityRows.push([communities[ci].name, communities[ci].market]);
    }
    // Ensure enough rows exist
    var needed = 12 + communities.length - 1;
    if (resultsSheet.getMaxRows() < needed) {
      resultsSheet.insertRowsAfter(resultsSheet.getMaxRows(), needed - resultsSheet.getMaxRows());
    }
    resultsSheet.getRange(12, 1, communities.length, 2).setValues(communityRows);
  }

  // ── 4b. Populate data columns ──
  // Re-read lastRow after rebuild
  lastRow = resultsSheet.getLastRow();
  if (lastRow < 1) {
    return { success: false, message: 'Sales Data Results sheet is empty' };
  }

  // Read column A (community names) for matching
  var targetColA = resultsSheet.getRange(1, 1, lastRow, 1).getValues();

  // Read existing values for each target column (preserve unmatched rows)
  var colC = resultsSheet.getRange(1, 3, lastRow, 1).getValues();   // Active Prospects
  var colD = resultsSheet.getRange(1, 4, lastRow, 1).getValues();   // Appointments Held
  var colE = resultsSheet.getRange(1, 5, lastRow, 1).getValues();   // Total New Leads
  var colG = resultsSheet.getRange(1, 7, lastRow, 1).getValues();   // Digital Leads
  var colH = resultsSheet.getRange(1, 8, lastRow, 1).getValues();   // In-Person Leads
  var colJ = resultsSheet.getRange(1, 10, lastRow, 1).getValues();  // Call Leads
  var colL = resultsSheet.getRange(1, 12, lastRow, 1).getValues();  // VIP List Signups

  var rowsUpdated = 0;

  for (var i = 0; i < lastRow; i++) {
    var name = (targetColA[i][0] || '').toString().trim();
    if (!name) continue;

    var key = name.toLowerCase();
    var leads = leadsByCommunity[key];
    var prospects = prospectCounts[key] || 0;
    var appts = apptCounts[key] || 0;

    // Only update rows where we have matching lead data or sales data
    if (!leads && prospects === 0 && appts === 0) continue;

    colC[i][0] = prospects;
    colD[i][0] = appts;

    if (leads) {
      colE[i][0] = leads.totalNewLeads;
      colG[i][0] = leads.digitalLeads;
      colH[i][0] = leads.inPersonLeads;
      colJ[i][0] = leads.callLeads;
      colL[i][0] = leads.vipListSignups;
    }

    rowsUpdated++;
  }

  // Write all 7 columns back in batch
  resultsSheet.getRange(1, 3, lastRow, 1).setValues(colC);
  resultsSheet.getRange(1, 4, lastRow, 1).setValues(colD);
  resultsSheet.getRange(1, 5, lastRow, 1).setValues(colE);
  resultsSheet.getRange(1, 7, lastRow, 1).setValues(colG);
  resultsSheet.getRange(1, 8, lastRow, 1).setValues(colH);
  resultsSheet.getRange(1, 10, lastRow, 1).setValues(colJ);
  resultsSheet.getRange(1, 12, lastRow, 1).setValues(colL);

  // ── 5. Build Sales Reports tab ──
  handleBuildSalesReports(resultsSpreadsheet);

  // ── 6. System log ──
  logToSystemLog_('consolidateDashboard', 'success', 'Consolidated ' + rowsUpdated + ' rows, ' + Object.keys(leadsByCommunity).length + ' leads sources');

  return {
    success: true,
    rowsUpdated: rowsUpdated,
    leadsFound: Object.keys(leadsByCommunity).length,
    message: 'Consolidated ' + rowsUpdated + ' rows to Sales Data Results'
  };
}

/**
 * Safely converts a value to a number. Returns 0 for blanks/NaN.
 */
function toNum_(val) {
  if (val === '' || val === null || val === undefined) return 0;
  var n = Number(val);
  return isNaN(n) ? 0 : n;
}

/**
 * Returns the current week-ending date in short format (e.g. "Mar 22")
 * to match the Week Ending column in the Submissions tab.
 */
function getCurrentWeekEndingShort_() {
  var today = new Date();
  var day = today.getDay(); // 0=Sun
  var diff = day === 0 ? 0 : 7 - day;
  var sun = new Date(today);
  sun.setDate(today.getDate() + diff);
  return MONTHS_SHORT[sun.getMonth()] + ' ' + sun.getDate();
}

// ══════════════════════════════════════════════════════════════
// BUILD SALES REPORTS
// ══════════════════════════════════════════════════════════════
//
// Writes a "Sales Reports" tab in the results sheet showing
// submission status for each rep (Sales Log + Leads Report).
// ══════════════════════════════════════════════════════════════

function handleBuildSalesReports(resultsSpreadsheet) {
  if (!resultsSpreadsheet) {
    resultsSpreadsheet = SpreadsheetApp.openById(RESULTS_SHEET_ID);
  }

  var REPS = ['Brittni', 'Rylie', 'Alyssa', 'Kaitlyn J', 'Helen Adams', 'Stefan', 'Kelsey/Brittni', 'Other'];

  // Get or create Sales Reports tab
  var reportSheet = resultsSpreadsheet.getSheetByName('Sales Reports');
  if (!reportSheet) {
    reportSheet = resultsSpreadsheet.insertSheet('Sales Reports');
  }
  reportSheet.clear();

  var currentWeekEnding = getCurrentWeekEndingShort_();

  // ── Section 1: Sales Log Submissions ──
  var submissionsSheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Submissions');
  var submittedReps = {};
  if (submissionsSheet && submissionsSheet.getLastRow() > 1) {
    var sData = submissionsSheet.getDataRange().getValues();
    var sHeaders = sData[0];
    var sRepIdx = sHeaders.indexOf('Rep Name');
    var sWeekIdx = sHeaders.indexOf('Week Ending');
    var sTimestampIdx = sHeaders.indexOf('Timestamp');

    if (sRepIdx >= 0) {
      for (var i = 1; i < sData.length; i++) {
        var weekVal = (sData[i][sWeekIdx] || '').toString().trim();
        if (sWeekIdx >= 0 && currentWeekEnding && weekVal !== currentWeekEnding) continue;
        var repName = (sData[i][sRepIdx] || '').toString().trim();
        if (repName) {
          submittedReps[repName] = (sData[i][sTimestampIdx] || '').toString();
        }
      }
    }
  }

  // ── Section 2: Leads Report (Copper Leads Dashboard) ──
  var leadsSheet = SpreadsheetApp.openById(LEADS_SHEET_ID).getSheetByName('Dashboard');
  var leadsSubmitted = {};
  if (leadsSheet) {
    // Check if any community rows have non-zero values in data columns (C onwards)
    var lr = leadsSheet.getLastRow();
    if (lr >= 9) {
      var leadsData = leadsSheet.getRange(9, 1, lr - 8, Math.max(leadsSheet.getLastColumn(), 35)).getValues();
      // If any data cell is non-zero, leads are populated
      var hasLeadsData = false;
      for (var i = 0; i < leadsData.length; i++) {
        for (var c = 2; c < leadsData[i].length; c++) {
          if (toNum_(leadsData[i][c]) > 0) {
            hasLeadsData = true;
            break;
          }
        }
        if (hasLeadsData) break;
      }
      if (hasLeadsData) {
        leadsSubmitted['_all'] = true;
      }
    }
  }

  // ── Write report ──
  var rows = [];
  rows.push(['Sales Reports — Week Ending ' + currentWeekEnding, '', '']);
  rows.push(['', '', '']);
  rows.push(['Rep Name', 'Sales Log', 'Leads Report']);

  for (var r = 0; r < REPS.length; r++) {
    var rep = REPS[r];
    var salesStatus = submittedReps[rep] ? 'Submitted' : 'MISSING';
    var leadsStatus = leadsSubmitted['_all'] ? 'COMPLETE' : 'NOT SUBMITTED';
    rows.push([rep, salesStatus, leadsStatus]);
  }

  reportSheet.getRange(1, 1, rows.length, 3).setValues(rows);

  // Bold the header row
  reportSheet.getRange(1, 1, 1, 3).setFontWeight('bold');
  reportSheet.getRange(3, 1, 1, 3).setFontWeight('bold');

  return { success: true, repsChecked: REPS.length };
}


// ══════════════════════════════════════════════════════════════
// SYSTEM LOGGING
// ══════════════════════════════════════════════════════════════

/**
 * Appends a log entry to the "System Log" tab in the Sales App sheet.
 * Auto-creates the tab if it doesn't exist.
 */
function logToSystemLog_(action, status, message) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var logSheet = ss.getSheetByName('System Log');
    if (!logSheet) {
      logSheet = ss.insertSheet('System Log');
      logSheet.getRange(1, 1, 1, 4).setValues([['Timestamp', 'Action', 'Status', 'Message']]);
      logSheet.getRange(1, 1, 1, 4).setFontWeight('bold');
    }
    logSheet.appendRow([new Date().toISOString(), action, status, message]);
  } catch (e) {
    // Logging should never break the main operation
    Logger.log('System log write failed: ' + e.message);
  }
}


/**
 * Debug helper — returns community names from both sheets for comparison.
 */
function debugConsolidateNames_() {
  // Copper Leads Dashboard — community names from col A, rows 9+
  var leadsNames = [];
  var leadsSheet = SpreadsheetApp.openById(LEADS_SHEET_ID).getSheetByName('Dashboard');
  if (leadsSheet) {
    var lr = leadsSheet.getLastRow();
    if (lr >= 9) {
      var ld = leadsSheet.getRange(9, 1, lr - 8, 2).getValues();
      for (var i = 0; i < ld.length; i++) {
        var n = (ld[i][0] || '').toString().trim();
        if (n) leadsNames.push({ row: i + 9, name: n, market: (ld[i][1] || '').toString().trim() });
      }
    }
  }

  // Sales Data Results — community names from col A, all rows
  var resultsNames = [];
  var resultsTabNames = [];
  var resultsSpreadsheet = SpreadsheetApp.openById(RESULTS_SHEET_ID);
  var allSheets = resultsSpreadsheet.getSheets();
  for (var s = 0; s < allSheets.length; s++) {
    resultsTabNames.push(allSheets[s].getName());
  }

  var resultsSheet = resultsSpreadsheet.getSheetByName('Sales Data Results');
  if (resultsSheet) {
    var rr = resultsSheet.getLastRow();
    if (rr >= 1) {
      var rd = resultsSheet.getRange(1, 1, rr, 2).getValues();
      for (var i = 0; i < rd.length; i++) {
        var n = (rd[i][0] || '').toString().trim();
        if (n) resultsNames.push({ row: i + 1, name: n, col_b: (rd[i][1] || '').toString().trim() });
      }
    }
  }

  return {
    copperLeadsDashboard: leadsNames,
    salesDataResults: resultsNames,
    resultsSheetTabs: resultsTabNames
  };
}
