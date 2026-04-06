// Reads assignment data from Supabase (previously from Google Sheets).
// Function names kept for backward compatibility with callers.

import { supabase } from './db.js';
import { getWeekEndingSunday } from './sheets.js';

/**
 * Returns all active communities with their division.
 * Used by consolidation and OSC rotation to build community lists.
 * @returns {Array<{name: string, market: string}>}
 */
export async function getActiveCommunities() {
  const { data, error } = await supabase
    .from('communities')
    .select('name, division')
    .eq('is_active', true)
    .order('division')
    .order('name');

  if (error) throw error;
  return (data || []).map(c => ({ name: c.name, market: c.division }));
}

/**
 * Returns unique rep names who have assignments for the current week.
 * Used by monday-night Phase 1 to determine expected submitters.
 * @returns {string[]}
 */
export async function getAssignedReps() {
  const weekEnding = getWeekEndingSunday().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('assignments')
    .select('reps(name)')
    .eq('week_ending', weekEnding);

  if (error) throw error;

  const names = [...new Set((data || []).map(a => a.reps.name))]
    .filter(n => {
      const lower = n.toLowerCase();
      return lower !== 'n/a' && lower !== 'none' && lower !== 'na';
    });

  return names.sort();
}
