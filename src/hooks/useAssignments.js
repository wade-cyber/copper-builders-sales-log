import { useState, useEffect } from 'react';
import { fetchAssignments } from '../utils/api';

const SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL;

export function useAssignments(rep) {
  const [assignments, setAssignments] = useState({
    communities: [],
    singleHomes: [],
    boyl: [],
    renovations: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  // Fetch last sync timestamp once on mount
  useEffect(() => {
    if (!SCRIPT_URL) return;
    fetch(`${SCRIPT_URL}?action=getLastSync`)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.lastSynced) setLastSyncedAt(new Date(data.lastSynced));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!rep) {
      setAssignments({ communities: [], singleHomes: [], boyl: [], renovations: [] });
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchAssignments(rep)
      .then((data) => {
        if (cancelled) return;
        const grouped = { communities: [], singleHomes: [], boyl: [], renovations: [] };
        (Array.isArray(data) ? data : []).forEach((a) => {
          const type = (a.assignmentType || '').toLowerCase().replace('-', '');
          if (type === 'community') grouped.communities.push(a);
          else if (type === 'singlehome') grouped.singleHomes.push(a);
          else if (type === 'boyl') grouped.boyl.push(a);
          else if (type === 'renovation') grouped.renovations.push(a);
        });
        setAssignments(grouped);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [rep]);

  return { assignments, loading, error, lastSyncedAt };
}
