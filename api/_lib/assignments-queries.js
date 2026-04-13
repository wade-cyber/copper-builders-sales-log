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
 * Returns unique rep names from the current week's assignments.
 * Falls back to the most recent week if this week has no assignments yet.
 * Used by monday-night Phase 1 to determine expected submitters.
 * @returns {string[]}
 */
export async function getAssignedReps() {
  const weekEnding = getWeekEndingSunday().toISOString().slice(0, 10);

  let { data, error } = await supabase
    .from('assignments')
    .select('reps(name)')
    .eq('week_ending', weekEnding);
  if (error) throw error;

  // Fallback to most recent week if current week has no assignments yet
  if (!data || data.length === 0) {
    const { data: recent, error: rErr } = await supabase
      .from('assignments')
      .select('reps(name), week_ending')
      .not('week_ending', 'is', null)
      .order('week_ending', { ascending: false })
      .limit(200);
    if (rErr) throw rErr;
    const mostRecent = recent?.[0]?.week_ending;
    data = mostRecent ? recent.filter(a => a.week_ending === mostRecent) : [];

    // Last resort: NULL-week legacy rows
    if (data.length === 0) {
      const { data: legacy } = await supabase.from('assignments').select('reps(name)').is('week_ending', null);
      data = legacy || [];
    }
  }

  const names = [...new Set((data || []).map(a => a.reps.name))]
    .filter(n => {
      const lower = n.toLowerCase();
      return lower !== 'n/a' && lower !== 'none' && lower !== 'na';
    });

  return names.sort();
}
