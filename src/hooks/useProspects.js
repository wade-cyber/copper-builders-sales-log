import { useState, useEffect, useCallback } from 'react';
import { fetchProspects, saveProspect } from '../utils/api';

export function useProspects(rep) {
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saveErrors, setSaveErrors] = useState({});

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

  const handleSaveError = useCallback((id, err) => {
    setSaveErrors((prev) => ({ ...prev, [id]: err.message || 'Save failed' }));
  }, []);

  const clearSaveError = useCallback((id) => {
    setSaveErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const retrySave = useCallback((id) => {
    clearSaveError(id);
    setProspects((current) => {
      const prospect = current.find((p) => p.id === id);
      if (prospect) {
        saveProspect({ ...prospect, rep }).catch((err) => handleSaveError(id, err));
      }
      return current;
    });
  }, [rep, clearSaveError, handleSaveError]);

  const addProspect = useCallback((prospect) => {
    const newProspect = {
      ...prospect,
      id: crypto.randomUUID(),
      status: 'active',
      createdDate: new Date().toISOString(),
    };
    setProspects((prev) => [...prev, newProspect]);
    saveProspect({ ...newProspect, rep }).catch((err) => handleSaveError(newProspect.id, err));
    return newProspect;
  }, [rep, handleSaveError]);

  // Fixed: combine state update + API call in single setProspects to avoid race condition
  const updateProspect = useCallback((id, updates) => {
    setProspects((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, ...updates } : p));
      const updated = next.find((p) => p.id === id);
      if (updated) saveProspect({ ...updated, rep }).catch((err) => handleSaveError(id, err));
      return next;
    });
  }, [rep, handleSaveError]);

  const removeProspect = useCallback((id) => {
    setProspects((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, status: 'removed' } : p));
      const updated = next.find((p) => p.id === id);
      if (updated) saveProspect({ ...updated, rep }).catch((err) => handleSaveError(id, err));
      return next;
    });
  }, [rep, handleSaveError]);

  const markSold = useCallback((id) => {
    setProspects((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, status: 'sold' } : p));
      const updated = next.find((p) => p.id === id);
      if (updated) saveProspect({ ...updated, rep }).catch((err) => handleSaveError(id, err));
      return next;
    });
  }, [rep, handleSaveError]);

  return { prospects, loading, saveErrors, addProspect, updateProspect, removeProspect, markSold, retrySave };
}
