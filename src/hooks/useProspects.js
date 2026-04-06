import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchProspects, saveProspect } from '../utils/api';

export function useProspects(rep) {
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [saveErrors, setSaveErrors] = useState({});
  const debounceTimers = useRef({});

  useEffect(() => {
    if (!rep) { setProspects([]); return; }

    let cancelled = false;
    setLoading(true);

    setFetchError(null);
    fetchProspects(rep)
      .then((data) => {
        if (!cancelled) setProspects(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setProspects([]);
          setFetchError(err.message || 'Failed to load prospects');
        }
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

  // Debounced save: waits 500ms after last change before firing API call
  const debouncedSave = useCallback((id, prospectData) => {
    if (debounceTimers.current[id]) clearTimeout(debounceTimers.current[id]);
    debounceTimers.current[id] = setTimeout(() => {
      saveProspect({ ...prospectData, rep }).catch((err) => handleSaveError(id, err));
      delete debounceTimers.current[id];
    }, 500);
  }, [rep, handleSaveError]);

  const updateProspect = useCallback((id, updates) => {
    setProspects((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, ...updates } : p));
      const updated = next.find((p) => p.id === id);
      if (updated) debouncedSave(id, updated);
      return next;
    });
  }, [debouncedSave]);

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

  return { prospects, loading, fetchError, saveErrors, addProspect, updateProspect, removeProspect, markSold, retrySave };
}
