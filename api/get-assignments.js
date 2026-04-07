// GET /api/get-assignments?rep=Name — returns assignments for a rep
// Without ?rep param: returns all active communities
// Uses current week, falls back to most recent week with data
import { supabase } from './_lib/db.js';
import { getWeekEndingSunday } from './_lib/sheets.js';

async function getAssignmentsForWeek(weekEnding) {
  return supabase
    .from('assignments')
    .select('communities(name), reps(name), third_party')
    .eq('week_ending', weekEnding);
}

export default async function handler(req, res) {
  try {
    const rep = req.query.rep || '';
    const weekEnding = getWeekEndingSunday().toISOString().slice(0, 10);

    let { data: allAssignments, error } = await getAssignmentsForWeek(weekEnding);
    if (error) throw error;

    // If no assignments for current week, use most recent week
    if (!allAssignments || allAssignments.length === 0) {
      const { data: latest } = await supabase
        .from('assignments')
        .select('week_ending')
        .order('week_ending', { ascending: false })
        .limit(1)
        .single();

      if (latest) {
        ({ data: allAssignments, error } = await getAssignmentsForWeek(latest.week_ending));
        if (error) throw error;
      }
    }

    if (!allAssignments || allAssignments.length === 0) return res.status(200).json([]);

    const counts = {};
    for (const a of allAssignments) {
      const name = a.communities.name;
      counts[name] = (counts[name] || 0) + 1;
    }

    // No rep provided: return all unique communities
    if (!rep) {
      const seen = {};
      const results = [];
      for (const a of allAssignments) {
        const name = a.communities.name;
        if (seen[name]) continue;
        seen[name] = true;
        results.push({
          name,
          assignmentName: name,
          assignmentType: counts[name] > 1 ? 'community' : 'single-home',
          thirdParty: (a.third_party || '').toLowerCase(),
        });
      }
      return res.status(200).json(results);
    }

    // Rep provided: return that rep's assignments
    const results = [];
    const seen = new Set();
    for (const a of allAssignments) {
      if (a.reps.name !== rep) continue;
      const name = a.communities.name;
      if (seen.has(name)) continue;
      seen.add(name);
      results.push({
        name,
        assignmentName: name,
        assignmentType: counts[name] > 1 ? 'community' : 'single-home',
        thirdParty: (a.third_party || '').toLowerCase(),
      });
    }
    return res.status(200).json(results);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
