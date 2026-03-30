// GET /api/health — system health check
import { supabase } from './_lib/db.js';

export default async function handler(req, res) {
  const checks = { database: 'unknown', tables: {} };
  let status = 'healthy';

  // Test DB connection
  try {
    const { count: commCount } = await supabase.from('communities').select('*', { count: 'exact', head: true });
    const { count: repCount } = await supabase.from('reps').select('*', { count: 'exact', head: true });
    const { count: subCount } = await supabase.from('weekly_submissions').select('*', { count: 'exact', head: true });
    const { count: prospectCount } = await supabase.from('prospects').select('*', { count: 'exact', head: true });

    checks.database = 'connected';
    checks.tables = { communities: commCount, reps: repCount, submissions: subCount, prospects: prospectCount };
  } catch (e) {
    checks.database = 'error: ' + e.message;
    status = 'unhealthy';
  }

  // Last successful run
  try {
    const { data: lastRun } = await supabase
      .from('run_log')
      .select('*')
      .eq('status', 'success')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();
    checks.last_run = lastRun || null;
  } catch {
    checks.last_run = null;
  }

  // Errors in last 24h
  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const { count } = await supabase
      .from('error_log')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday);
    checks.errors_last_24h = count;
    if (count > 5) status = 'degraded';
  } catch {
    checks.errors_last_24h = null;
  }

  return res.status(status === 'healthy' ? 200 : 503).json({
    status,
    ...checks,
    timestamp: new Date().toISOString(),
  });
}
