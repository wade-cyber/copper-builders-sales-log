// GET /api/get-assignments?rep=Name — returns assignments for a rep
// Without ?rep param: returns all active communities
import { supabase } from './_lib/db.js';

export default async function handler(req, res) {
  try {
    const rep = req.query.rep || '';

    const { data: allAssignments, error } = await supabase
      .from('assignments')
      .select('communities(name), reps(name), third_party');
    if (error) throw error;

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
