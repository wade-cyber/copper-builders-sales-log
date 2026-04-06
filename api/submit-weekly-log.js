// POST /api/submit-weekly-log — write to Supabase
import { supabase } from './_lib/db.js';
import { resolveOrCreateRep, resolveOrCreateCommunity, clearResolverCache } from './_lib/resolve-names.js';
import { requireAuth } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const auth = requireAuth(req);
  if (!auth.authorized) return res.status(401).json({ error: auth.error });

  try {
    const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    clearResolverCache();

    const rep = await resolveOrCreateRep(data.repName);
    const sections = data.sections || [];

    for (const section of sections) {
      const community = await resolveOrCreateCommunity(section.name);
      const appts = section.appointments || {};
      const prospects = section.prospects || [];
      const dl = section.directLeads || {};

      await supabase.from('weekly_submissions').upsert({
        rep_id: rep.id,
        community_id: community.id,
        week_ending: parseWeekEnding(data.weekEnding),
        section_type: section.type || null,
        appts_virtual: appts.virtual || 0,
        appts_in_person: appts.inPerson || 0,
        total_appts: section.totalAppointments || 0,
        leads_digital: dl.digital || 0,
        leads_phone: dl.phoneCall || 0,
        leads_in_person: dl.inPerson || 0,
        active_prospects: prospects.filter(p => p.status === 'active').length,
        sold_prospects: prospects.filter(p => p.status === 'sold').length,
        removed_prospects: prospects.filter(p => p.status === 'removed').length,
        grand_total_appts: (data.totals || {}).totalAppointments || 0,
        submitted_at: data.timestamp || new Date().toISOString(),
      }, { onConflict: 'rep_id,community_id,week_ending' });

      // Update prospect statuses in DB (sold/removed)
      for (const prospect of prospects) {
        if (prospect.status !== 'sold' && prospect.status !== 'removed') continue;
        await supabase.from('prospects')
          .update({
            status: prospect.status,
            ranking: prospect.ranking || undefined,
            next_step: prospect.nextStep || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq('rep_id', rep.id)
          .eq('community_id', community.id)
          .eq('prospect_name', prospect.name);
      }
    }

    return res.status(200).json({ success: true, message: 'Submitted successfully' });
  } catch (err) {
    console.error('[submit-weekly-log]', err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}

/** Parse "Mar 29" or "Mar 30" style week ending to ISO date string. */
function parseWeekEnding(weekEndingStr) {
  if (!weekEndingStr) return new Date().toISOString().slice(0, 10);
  const months = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
  const parts = weekEndingStr.replace(/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\s+/i, '').trim().split(/\s+/);
  if (parts.length >= 2) {
    const mon = months[parts[0]];
    const day = parseInt(parts[1]);
    if (mon !== undefined && !isNaN(day)) {
      const now = new Date();
      let year = now.getFullYear();
      // Handle year boundary: Dec week ending submitted in January
      if (mon === 11 && now.getMonth() === 0) year--;
      // Handle year boundary: Jan week ending submitted in December
      if (mon === 0 && now.getMonth() === 11) year++;
      return `${year}-${String(mon + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return weekEndingStr;
}
