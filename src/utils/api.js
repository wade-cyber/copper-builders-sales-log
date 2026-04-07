const API_BASE = '/api';

/** Retry wrapper with exponential backoff (3 attempts, 1s/2s/4s delays).
 *  Only retries on 5xx and network errors. 4xx errors fail immediately. */
async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        // 4xx: client error — don't retry, fail immediately
        if (res.status >= 400 && res.status < 500) {
          const body = await res.json().catch(() => ({}));
          throw Object.assign(new Error(body.error || `Request failed (${res.status})`), { noRetry: true });
        }
        throw new Error(`Server error (${res.status})`);
      }
      return res;
    } catch (err) {
      // Don't retry client errors (4xx) — they won't succeed
      if (err.noRetry || attempt === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
}

export async function fetchReps() {
  const url = `${API_BASE}/get-reps?t=${Date.now()}`;
  const res = await fetchWithRetry(url);
  return res.json();
}

export async function fetchAssignments(rep) {
  const url = `${API_BASE}/get-assignments?rep=${encodeURIComponent(rep)}&t=${Date.now()}`;
  const res = await fetchWithRetry(url);
  return res.json();
}

export async function fetchProspects(rep) {
  const url = `${API_BASE}/get-prospects?rep=${encodeURIComponent(rep)}&t=${Date.now()}`;
  const res = await fetchWithRetry(url);
  return res.json();
}

export async function submitWeeklyLog(data) {
  const res = await fetchWithRetry(`${API_BASE}/submit-weekly-log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function fetchSubmissionStatus(rep) {
  const url = `${API_BASE}/reports?type=submission-timeline&t=${Date.now()}`;
  const res = await fetchWithRetry(url);
  const data = await res.json();
  if (!data.success || !data.data) return { submitted: false };
  const match = data.data.find(s => s.rep === rep);
  if (match) return { submitted: true, submitted_at: match.submitted_at };
  return { submitted: false };
}

export async function saveProspect(prospect) {
  const res = await fetchWithRetry(`${API_BASE}/save-prospect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prospect),
  });
  return res.json();
}
