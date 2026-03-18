import { useState, useEffect, useCallback } from 'react';
import { fetchProspects, saveProspect } from '../utils/api';

export function useProspects(rep) {
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!rep) { setProspects([]); return; }

    let cancelled = false;
    setLoading(true);

    fetchProspects(rep)
      .then((data) => {
        if (!cancelled) setProspects(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setProspects([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [rep]);

  const addProspect = useCallback((prospect) => {
    const newProspect = {
      ...prospect,
      id: crypto.randomUUID(),
      status: 'active',
      createdDate: new Date().toISOString(),
    };
    setProspects((prev) => [...prev, newProspect]);
    saveProspect({ ...newProspect, rep }).catch(() => {});
    return newProspect;
  }, [rep]);

  const updateProspect = useCallback((id, updates) => {
    setProspects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
    setProspects((current) => {
      const prospect = current.find((p) => p.id === id);
      if (prospect) saveProspect({ ...prospect, rep }).catch(() => {});
      return current;
    });
  }, [rep]);

  const removeProspect = useCallback((id) => {
    setProspects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'removed' } : p))
    );
    setProspects((current) => {
      const prospect = current.find((p) => p.id === id);
      if (prospect) saveProspect({ ...prospect, rep }).catch(() => {});
      return current;
    });
  }, [rep]);

  const markSold = useCallback((id) => {
    setProspects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'sold' } : p))
    );
    setProspects((current) => {
      const prospect = current.find((p) => p.id === id);
      if (prospect) saveProspect({ ...prospect, rep }).catch(() => {});
      return current;
    });
  }, [rep]);

  return { prospects, loading, addProspect, updateProspect, removeProspect, markSold };
}
