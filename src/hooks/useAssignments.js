import { useState, useEffect } from 'react';
import { fetchAssignments } from '../utils/api';

export function useAssignments(rep) {
  const [assignments, setAssignments] = useState({
    communities: [],
    singleHomes: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  // Fetch last sync timestamp — if it fails, set to null so stale-data warning defaults to showing
  useEffect(() => {
    fetch(`/api/get-last-sync?t=${Date.now()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.lastSynced) setLastSyncedAt(new Date(data.lastSynced));
        else setLastSyncedAt(null);
      })
      .catch(() => {
        setLastSyncedAt(null);
      });
  }, []);

  useEffect(() => {
    if (!rep) {
      setAssignments({ communities: [], singleHomes: [] });
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchAssignments(rep)
      .then((data) => {
        if (cancelled) return;
        const grouped = { communities: [], singleHomes: [] };
        (Array.isArray(data) ? data : []).forEach((a) => {
          const type = (a.assignmentType || '').toLowerCase().replace('-', '');
          if (type === 'singlehome') grouped.singleHomes.push(a);
          else grouped.communities.push(a);
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
