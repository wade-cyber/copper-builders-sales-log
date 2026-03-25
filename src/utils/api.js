const API_BASE = '/api';

/** Retry wrapper with exponential backoff (3 attempts, 1s/2s/4s delays) */
async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        // Don't retry 4xx client errors
        if (res.status >= 400 && res.status < 500) {
          throw new Error(`Request failed (${res.status})`);
        }
        throw new Error(`Server error (${res.status})`);
      }
      return res;
    } catch (err) {
      if (attempt === retries - 1) throw err;
      // Exponential backoff: 1s, 2s, 4s
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

export async function fetchAllCommunities() {
  const url = `${API_BASE}/get-assignments?t=${Date.now()}`;
  const res = await fetchWithRetry(url);
  return res.json();
}

export async function fetchSubmittedReps() {
  const url = `${API_BASE}/get-submitted-reps?t=${Date.now()}`;
  const res = await fetchWithRetry(url);
  return res.json();
}

export async function saveProspect(prospect) {
  const res = await fetchWithRetry(`${API_BASE}/save-prospect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prospect),
  });
  return res.json();
}
