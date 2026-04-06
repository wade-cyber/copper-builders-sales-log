// Resolves community and rep names to database IDs.
// Uses case-insensitive matching on the name column.
// Caches results per request to avoid repeated DB lookups.

import { supabase } from './db.js';

let _communityCache = null;
let _repCache = null;

async function loadCommunities() {
  if (_communityCache) return _communityCache;
  const { data, error } = await supabase
    .from('communities')
    .select('id, name, division')
    .eq('is_active', true);
  if (error) throw new Error('Failed to load communities: ' + error.message);
  _communityCache = data;
  return data;
}

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

export async function resolveCommunity(nameStr) {
  if (!nameStr) return null;
  const needle = nameStr.trim().toLowerCase();
  const communities = await loadCommunities();
  for (const c of communities) {
    if (c.name.toLowerCase() === needle) return c;
  }
  return null;
}

export async function resolveRep(nameStr) {
  if (!nameStr) return null;
  const needle = nameStr.trim().toLowerCase();
  const reps = await loadReps();
  for (const r of reps) {
    if (r.name.toLowerCase() === needle) return r;
  }
  return null;
}

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
  _repCache = null;
  return data;
}

export async function resolveOrCreateCommunity(nameStr, division = 'CLT') {
  const existing = await resolveCommunity(nameStr);
  if (existing) return existing;

  const trimmed = nameStr.trim();
  const match = trimmed.match(/[-–]\s*(CLT|CLB|TRN|GVL|WIL)\s*$/i);
  const div = match ? match[1].toUpperCase() : division;

  const { data, error } = await supabase
    .from('communities')
    .insert({ name: trimmed, division: div })
    .select()
    .single();
  if (error) throw new Error(`Failed to create community "${trimmed}": ${error.message}`);
  _communityCache = null;
  return data;
}

export function clearResolverCache() {
  _communityCache = null;
  _repCache = null;
}
