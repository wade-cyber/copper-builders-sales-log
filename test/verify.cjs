// Verification script — reads all Google Sheets and reports current state
// Usage: node test/verify.js

const fs = require('fs');
const { google } = require('googleapis');

const env = {};
fs.readFileSync('.env', 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^#=]+?)=(.*)$/);
  if (m) {
    let val = m[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[m[1].trim()] = val;
  }
});

const auth = new google.auth.JWT({
  email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

async function readSheet(id, range) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: id, range });
  return res.data.values || [];
}

async function getTabs(id) {
  const res = await sheets.spreadsheets.get({ spreadsheetId: id, fields: 'sheets.properties' });
  return res.data.sheets.map(s => s.properties.title);
}

(async () => {
  const SA = env.SALES_APP_SHEET_ID;
  const CL = env.LEADS_SHEET_ID;

  console.log('╔══════════════════════════════════════╗');
  console.log('║   SALES LOG VERIFICATION REPORT      ║');
  console.log('╚══════════════════════════════════════╝\n');

  // 1. Sales App tabs
  const saTabs = await getTabs(SA);
  console.log('=== Sales App Reporting Tabs ===');
  for (const t of saTabs) console.log('  • ' + t);

  // 2. Copper Leads tabs
  const clTabs = await getTabs(CL);
  console.log('\n=== Copper Leads Tabs ===');
  for (const t of clTabs) console.log('  • ' + t);

  // 3. Submissions count by week
  console.log('\n=== Submissions by Week ===');
  try {
    const subs = await readSheet(SA, 'Submissions');
    if (subs.length > 1) {
      const weekIdx = subs[0].indexOf('Week Ending');
      const repIdx = subs[0].indexOf('Rep Name');
      const byWeek = {};
      for (let i = 1; i < subs.length; i++) {
        const week = subs[i][weekIdx] || '?';
        if (!byWeek[week]) byWeek[week] = new Set();
        byWeek[week].add(subs[i][repIdx] || '?');
      }
      for (const [week, reps] of Object.entries(byWeek)) {
        console.log(`  ${week}: ${reps.size} reps (${[...reps].join(', ')})`);
      }
    } else {
      console.log('  (no submissions)');
    }
  } catch { console.log('  (no Submissions tab)'); }

  // 4. Prospects summary
  console.log('\n=== Prospects ===');
  try {
    const pros = await readSheet(SA, 'Prospects');
    if (pros.length > 1) {
      const statusIdx = pros[0].indexOf('Status');
      let active = 0, sold = 0, removed = 0;
      for (let i = 1; i < pros.length; i++) {
        const s = (pros[i][statusIdx] || 'active').toLowerCase();
        if (s === 'active') active++;
        else if (s === 'sold') sold++;
        else if (s === 'removed') removed++;
      }
      console.log(`  Active: ${active}, Sold: ${sold}, Removed: ${removed}`);
    } else {
      console.log('  (no prospects)');
    }
  } catch { console.log('  (no Prospects tab)'); }

  // 5. Sales Data Results
  console.log('\n=== Sales Data Results ===');
  try {
    const sdr = await readSheet(SA, "'Sales Data Results'");
    if (sdr.length > 0) {
      // Print header
      console.log('  ' + sdr[0].join(' | '));
      console.log('  ' + '-'.repeat(80));
      for (let i = 1; i < sdr.length; i++) {
        const row = sdr[i];
        // Only print rows with non-zero data
        const hasData = row.slice(2).some(v => v && v !== '0' && v !== '');
        if (hasData) console.log('  ' + row.join(' | '));
      }
      console.log(`  (${sdr.length - 1} total rows)`);
    } else {
      console.log('  (empty)');
    }
  } catch { console.log('  (no Sales Data Results tab)'); }

  // 6. Sales Reports
  console.log('\n=== Sales Reports ===');
  try {
    const sr = await readSheet(SA, "'Sales Reports'");
    for (const row of sr) {
      if (row[0]) console.log('  ' + row.join(' | '));
    }
  } catch { console.log('  (no Sales Reports tab)'); }

  // 7. Dashboard Template — check week ending date and community count
  console.log('\n=== Dashboard Template ===');
  try {
    const dt = await readSheet(CL, "'Dashboard Template'!A2:B2");
    console.log('  Week ending: ' + (dt[0] && dt[0][1] || '?'));
    const dtComm = await readSheet(CL, "'Dashboard Template'!A17:B50");
    const communities = dtComm.filter(r => r[0] && r[0].trim());
    console.log('  Communities: ' + communities.length);
    for (const c of communities) console.log('    - ' + c[0] + ' (' + (c[1]||'?') + ')');
  } catch { console.log('  (error reading Dashboard Template)'); }

  console.log('\n✓ Verification complete');
})();
