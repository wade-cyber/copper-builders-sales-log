// Consolidated admin CRUD endpoint
// GET/POST /api/admin?action=list-communities|upsert-community|list-reps|...
import { supabase } from './_lib/db.js';
import { getWeekEndingSunday } from './_lib/sheets.js';
import { requireAuth } from './_lib/auth.js';

export default async function handler(req, res) {
  const auth = requireAuth(req);
  if (!auth.authorized) return res.status(401).json({ error: auth.error });
  const action = req.query.action || (req.body && req.body.action);
  if (!action) {
    return res.status(400).json({ error: 'Missing action parameter' });
  }

  try {
    switch (action) {
      case 'list-communities': return await listCommunities(res);
      case 'upsert-community': return await upsertCommunity(req, res);
      case 'list-reps': return await listReps(res);
      case 'upsert-rep': return await upsertRep(req, res);
      case 'list-assignments': return await listAssignments(req, res);
      case 'set-assignments': return await setAssignments(req, res);
      case 'remove-assignment': return await removeAssignment(req, res);
      case 'trigger-job': return await triggerJob(req, res);
      case 'run-history': return await runHistory(res);
      case 'error-log': return await errorLog(res);
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error(`[admin/${action}]`, err);
    return res.status(500).json({ error: err.message });
  }
}

async function listCommunities(res) {
  const { data, error } = await supabase
    .from('communities')
    .select('*')
    .order('division')
    .order('name');
  if (error) throw error;
  return res.status(200).json({ data });
}

async function upsertCommunity(req, res) {
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { id, name, division, is_active } = body;
  if (!name || !division) return res.status(400).json({ error: 'name and division required' });

  if (id) {
    const { data, error } = await supabase
      .from('communities')
      .update({ name, division, is_active: is_active !== false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return res.status(200).json({ data });
  } else {
    const { data, error } = await supabase
      .from('communities')
      .insert({ name, division, sheets_name: name, is_active: true })
      .select()
      .single();
    if (error) throw error;
    return res.status(201).json({ data });
  }
}

async function listReps(res) {
  const { data, error } = await supabase
    .from('reps')
    .select('*')
    .order('name');
  if (error) throw error;
  return res.status(200).json({ data });
}

async function upsertRep(req, res) {
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { id, name, email, is_active } = body;
  if (!name) return res.status(400).json({ error: 'name required' });

  if (id) {
    const { data, error } = await supabase
      .from('reps')
      .update({ name, email: email || null, is_active: is_active !== false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return res.status(200).json({ data });
  } else {
    const { data, error } = await supabase
      .from('reps')
      .insert({ name, email: email || null, is_active: true })
      .select()
      .single();
    if (error) throw error;
    return res.status(201).json({ data });
  }
}

async function listAssignments(req, res) {
  const weekEnding = req.query.week_ending || getWeekEndingSunday().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('assignments')
    .select('*, reps(name), communities(name, division)')
    .eq('week_ending', weekEnding)
    .order('created_at');
  if (error) throw error;
  return res.status(200).json({ data, week_ending: weekEnding });
}

async function setAssignments(req, res) {
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { rep_id, community_id, week_ending } = body;
  if (!rep_id || !community_id || !week_ending) {
    return res.status(400).json({ error: 'rep_id, community_id, and week_ending required' });
  }

  const { data, error } = await supabase
    .from('assignments')
    .upsert({ rep_id, community_id, week_ending, source: 'manual' }, { onConflict: 'rep_id,community_id,week_ending' })
    .select('*, reps(name), communities(name, division)')
    .single();
  if (error) throw error;
  return res.status(200).json({ data });
}

async function removeAssignment(req, res) {
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { id } = body;
  if (!id) return res.status(400).json({ error: 'id required' });

  const { error } = await supabase.from('assignments').delete().eq('id', id);
  if (error) throw error;
  return res.status(200).json({ success: true });
}

async function triggerJob(req, res) {
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { job } = body;
  if (!job) return res.status(400).json({ error: 'job required (monday-night or import-leads)' });

  const baseUrl = `https://${req.headers.host}`;
  const endpoint = job === 'import-leads' ? '/api/import-leads' : '/api/monday-night';
  const payload = job === 'monday-night' ? { phase: 2 } : {};

  const resp = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await resp.json();
  return res.status(200).json({ triggered: job, result });
}

async function runHistory(res) {
  const { data, error } = await supabase
    .from('run_log')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return res.status(200).json({ data });
}

async function errorLog(res) {
  const { data, error } = await supabase
    .from('error_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return res.status(200).json({ data });
}
