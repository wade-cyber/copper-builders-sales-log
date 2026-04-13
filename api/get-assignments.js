// GET /api/get-assignments?rep=Name — returns assignments for a rep
// Without ?rep param: returns all active communities
import { supabase } from './_lib/db.js';
import { getWeekEndingSunday } from './_lib/sheets.js';

export default async function handler(req, res) {
  try {
    const rep = req.query.rep || '';
    const weekEnding = getWeekEndingSunday().toISOString().slice(0, 10);

    // Query current week's assignments; fallback to most recent if cron hasn't run yet
    let { data: allAssignments, error } = await supabase
      .from('assignments')
      .select('communities(name), reps(name), third_party')
      .eq('week_ending', weekEnding);
    if (error) throw error;

    if (!allAssignments || allAssignments.length === 0) {
      const { data: recent, error: rErr } = await supabase
        .from('assignments')
        .select('communities(name), reps(name), third_party, week_ending')
        .not('week_ending', 'is', null)
        .order('week_ending', { ascending: false })
        .limit(500);
      if (rErr) throw rErr;
      const mostRecent = recent?.[0]?.week_ending;
      allAssignments = mostRecent ? recent.filter(a => a.week_ending === mostRecent) : [];

      // Last resort: NULL-week legacy rows
      if (allAssignments.length === 0) {
        const { data: legacy } = await supabase
          .from('assignments')
          .select('communities(name), reps(name), third_party')
          .is('week_ending', null);
        allAssignments = legacy || [];
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
