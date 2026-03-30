// Structured logging to run_log and error_log tables in Supabase.
import { supabase } from './db.js';

/**
 * Start a new run and return the run ID.
 * @param {string} runType - e.g., 'phase1_sync', 'phase2_consolidate', 'lead_import'
 * @returns {number} runId
 */
export async function startRun(runType) {
  const { data, error } = await supabase
    .from('run_log')
    .insert({ run_type: runType, status: 'running' })
    .select('id')
    .single();
  if (error) {
    console.error('[logger] Failed to start run:', error.message);
    return null;
  }
  return data.id;
}

/**
 * Log an error for a specific run.
 */
export async function logError(runId, errorType, message, context = null) {
  try {
    await supabase.from('error_log').insert({
      run_id: runId,
      error_type: errorType,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      stack_trace: message?.stack || null,
      context: context ? JSON.stringify(context) : null,
    });
  } catch (e) {
    console.error('[logger] Failed to log error:', e.message);
  }
}

/**
 * Complete a run with status and summary.
 */
export async function completeRun(runId, status, recordsProcessed = 0, summary = '') {
  if (!runId) return;
  try {
    await supabase.from('run_log').update({
      status,
      completed_at: new Date().toISOString(),
      records_processed: recordsProcessed,
      summary,
    }).eq('id', runId);
  } catch (e) {
    console.error('[logger] Failed to complete run:', e.message);
  }
}
