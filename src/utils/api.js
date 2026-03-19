const SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || '';

export const REPS = ['Brittni', 'Rylie', 'Alyssa', 'Kaitlyn J', 'Helen Adams', '34 North', 'Kelsey/Brittni', 'Other'];

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

export async function submitWeeklyLog(data) {
  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'submitWeeklyLog', ...data }),
  });
  if (!res.ok) throw new Error('Failed to submit weekly log');
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

export async function fetchAllCommunities() {
  const url = `${SCRIPT_URL}?action=getAssignments`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch communities');
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
