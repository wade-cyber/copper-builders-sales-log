// Resolves community and rep names to database IDs.
// Uses case-insensitive matching and checks name, smartsheet_name, sheets_name columns.
// Caches results per request to avoid repeated DB lookups.

import { supabase } from './db.js';

let _communityCache = null;
let _repCache = null;

/** Load all communities into memory (called once per request lifecycle). */
async function loadCommunities() {
  if (_communityCache) return _communityCache;
  const { data, error } = await supabase
    .from('communities')
    .select('id, name, division, smartsheet_name, sheets_name')
    .eq('is_active', true);
  if (error) throw new Error('Failed to load communities: ' + error.message);
  _communityCache = data;
  return data;
}

/** Load all reps into memory. */
async function loadReps() {
  if (_repCache) return _repCache;
  const { data, error } = await supabase
    .from('reps')
    .select('id, name')
    .eq('is_active', true);
  if (error) throw new Error('Failed to load reps: ' + error.message);
  _repCache = data;
  return data;
}

/**
 * Resolve a community name to its database ID.
 * Checks name, smartsheet_name, and sheets_name columns (case-insensitive).
 * @returns {{ id: number, name: string, division: string } | null}
 */
export async function resolveCommunity(nameStr) {
  if (!nameStr) return null;
  const needle = nameStr.trim().toLowerCase();
  const communities = await loadCommunities();

  for (const c of communities) {
    if (c.name.toLowerCase() === needle) return c;
    if (c.smartsheet_name && c.smartsheet_name.toLowerCase() === needle) return c;
    if (c.sheets_name && c.sheets_name.toLowerCase() === needle) return c;
  }
  return null;
}

/**
 * Resolve a rep name to its database ID.
 * @returns {{ id: number, name: string } | null}
 */
export async function resolveRep(nameStr) {
  if (!nameStr) return null;
  const needle = nameStr.trim().toLowerCase();
  const reps = await loadReps();

  for (const r of reps) {
    if (r.name.toLowerCase() === needle) return r;
  }
  return null;
}

/**
 * Resolve a rep name, creating the rep if they don't exist.
 * @returns {{ id: number, name: string }}
 */
export async function resolveOrCreateRep(nameStr) {
  const existing = await resolveRep(nameStr);
  if (existing) return existing;

  const trimmed = nameStr.trim();
  const { data, error } = await supabase
    .from('reps')
    .insert({ name: trimmed })
    .select()
    .single();
  if (error) throw new Error(`Failed to create rep "${trimmed}": ${error.message}`);

  // Bust cache
  _repCache = null;
  return data;
}

/**
 * Resolve a community name, creating it if it doesn't exist.
 * @returns {{ id: number, name: string, division: string }}
 */
export async function resolveOrCreateCommunity(nameStr, division = 'CLT') {
  const existing = await resolveCommunity(nameStr);
  if (existing) return existing;

  const trimmed = nameStr.trim();
  // Try to extract division from name suffix like "BOYL / Reno - CLT"
  const match = trimmed.match(/[-–]\s*(CLT|CLB|TRN|GVL|WIL)\s*$/i);
  const div = match ? match[1].toUpperCase() : division;

  const { data, error } = await supabase
    .from('communities')
    .insert({ name: trimmed, division: div, sheets_name: trimmed })
    .select()
    .single();
  if (error) throw new Error(`Failed to create community "${trimmed}": ${error.message}`);

  _communityCache = null;
  return data;
}

/** Clear cached data (call between requests if needed). */
export function clearResolverCache() {
  _communityCache = null;
  _repCache = null;
}
