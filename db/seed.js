// Seed script — reads live data from the Vercel app and inserts into Supabase.
// Run: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node db/seed.js

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://bhmjgfjybpfgjxwtbked.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

const APP_URL = 'https://copper-builders-log.vercel.app';

// Division mapping for communities that don't have a suffix in the name.
// These are inferred from the Assignments sheet Division column.
const DIVISION_OVERRIDES = {
  '2129 Queens Rd': 'CLT',
  '409 Queens': 'CLT',
  'Haywood': 'CLT',
  'Bella Ridge': 'CLT',
  'Davidson Woods': 'CLT',
  'Foundry': 'CLT',
  'Verbena': 'CLT',
  'McNeil Court': 'CLT',
  'Montebello': 'CLT',
  'Solaire': 'CLT',
  'Arbor Vista @ The Grove': 'CLT',
  'Edenburgh': 'CLT',
  'Oberlin': 'TRN',
  'Sunset Reach': 'TRN',
  'The Manors at Eastover': 'CLT',
  'Greenway': 'GVL',
  'Earp Farm': 'CLT',
  'Meadowood': 'CLT',
  'Walnut Cove': 'CLT',
};

function parseDivision(communityName) {
  // Try to extract division from name suffix like "BOYL / Reno - CLT"
  const match = communityName.match(/[-–]\s*(CLT|CLB|TRN|GVL|WIL)\s*$/i);
  if (match) return match[1].toUpperCase();
  return DIVISION_OVERRIDES[communityName] || 'CLT';
}

async function seed() {
  console.log('Fetching live data from', APP_URL, '...');

  // Fetch reps
  const repsRes = await fetch(`${APP_URL}/api/get-reps`);
  const repNames = await repsRes.json();
  console.log(`Found ${repNames.length} reps`);

  // Fetch communities
  const commsRes = await fetch(`${APP_URL}/api/get-assignments`);
  const communities = await commsRes.json();
  console.log(`Found ${communities.length} communities`);

  // Seed communities
  const commRows = communities.map(c => ({
    name: c.name,
    division: parseDivision(c.name),
    sheets_name: c.name,
    is_active: true,
  }));

  const { data: insertedComms, error: commErr } = await supabase
    .from('communities')
    .upsert(commRows, { onConflict: 'name' })
    .select();

  if (commErr) {
    console.error('Community insert error:', commErr);
  } else {
    console.log(`Seeded ${insertedComms.length} communities`);
  }

  // Seed reps
  const repRows = repNames.map(name => ({
    name,
    is_active: true,
  }));

  const { data: insertedReps, error: repErr } = await supabase
    .from('reps')
    .upsert(repRows, { onConflict: 'name' })
    .select();

  if (repErr) {
    console.error('Rep insert error:', repErr);
  } else {
    console.log(`Seeded ${insertedReps.length} reps`);
  }

  // Verify
  const { count: commCount } = await supabase.from('communities').select('*', { count: 'exact', head: true });
  const { count: repCount } = await supabase.from('reps').select('*', { count: 'exact', head: true });
  console.log(`\nVerification: ${commCount} communities, ${repCount} reps in database`);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
