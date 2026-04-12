import { supabase } from './api/_lib/db.js';

async function main() {
  const weekEnding = '2026-04-05';
  
  const { data: submissions, error } = await supabase
    .from('weekly_submissions')
    .select('leads_digital, leads_phone, leads_in_person, communities(name, division)')
    .eq('week_ending', weekEnding);
    
  if (error) {
    console.error('Error fetching submissions:', error);
    return;
  }
  
  console.log(`Total submissions for week ending ${weekEnding}:`, submissions.length);
  
  // Sum across all submissions
  let totalLeads = 0;
  let byDivision = { CLT: 0, CLB: 0, TRN: 0, GVL: 0 };
  let communityDetails = [];
  
  for (const s of submissions) {
    const leads = (s.leads_digital || 0) + (s.leads_phone || 0) + (s.leads_in_person || 0);
    totalLeads += leads;
    const division = s.communities?.division;
    if (division && byDivision.hasOwnProperty(division)) {
      byDivision[division] += leads;
    }
    communityDetails.push({
      community: s.communities?.name,
      division,
      leads,
      leads_digital: s.leads_digital,
      leads_phone: s.leads_phone,
      leads_in_person: s.leads_in_person,
    });
  }
  
  console.log('\n--- Sales Tool Database Totals ---');
  console.log('Total leads:', totalLeads);
  console.log('By division:', byDivision);
  console.log('\nCommunity breakdown:');
  communityDetails.forEach(c => {
    console.log(`  ${c.community} (${c.division}): ${c.leads} (digital ${c.leads_digital}, phone ${c.leads_phone}, in-person ${c.leads_in_person})`);
  });
  
  // Also fetch from dashboard API
  console.log('\n--- Dashboard API Data (from earlier fetch) ---');
  console.log('Leads: 50');
  console.log('By division: CLT 7, CLB 20, TRN 7, GVL 16');
  console.log('\n--- Discrepancy Analysis ---');
  console.log(`Sales tool leads: ${totalLeads}`);
  console.log(`Dashboard leads: 50`);
  console.log(`Difference: ${totalLeads - 50}`);
  
  console.log('\nPossible causes:');
  console.log('1. Some communities in sales tool not present in Google Sheet');
  console.log('2. Different definitions of "leads" (maybe dashboard excludes certain lead types)');
  console.log('3. Missing data for some divisions in Google Sheet');
}

main().catch(console.error);