const SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || '';

export const REPS = ['Brittni', 'Stefan', 'Kelsey', 'Rylie', 'Other'];

export async function fetchAssignments(rep) {
  const url = `${SCRIPT_URL}?action=getAssignments&rep=${encodeURIComponent(rep)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch assignments');
  return res.json();
}

export async function fetchProspects(rep) {
  const url = `${SCRIPT_URL}?action=getProspects&rep=${encodeURIComponent(rep)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch prospects');
  return res.json();
}

export async function submitReport(data) {
  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'submitReport', ...data }),
  });
  if (!res.ok) throw new Error('Failed to submit report');
  return res.json();
}

export async function saveProspect(prospect) {
  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'saveProspect', ...prospect }),
  });
  if (!res.ok) throw new Error('Failed to save prospect');
  return res.json();
}
