import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchProspects, saveProspect } from '../utils/api';

export function useProspects(rep) {
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [saveErrors, setSaveErrors] = useState({});
  const debounceTimers = useRef({});
  // Store the rep that was active when each error occurred (for retry)
  const errorContext = useRef({});

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

  const handleSaveError = useCallback((id, err, savedRep) => {
    setSaveErrors((prev) => ({ ...prev, [id]: err.message || 'Save failed' }));
    // Store the rep context for retry
    errorContext.current[id] = savedRep;
  }, []);

  const clearSaveError = useCallback((id) => {
    setSaveErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    delete errorContext.current[id];
  }, []);

  // Rollback: restore prospects to snapshot on save failure
  const saveWithRollback = useCallback((prospectData, currentRep) => {
    return saveProspect({ ...prospectData, rep: currentRep }).catch((err) => {
      // Rollback: revert the optimistic update
      setProspects((current) => {
        // If this was an add, remove it
        if (!current.find(p => p.id === prospectData.id && p._existed)) {
          return current.filter(p => p.id !== prospectData.id);
        }
        // Otherwise restore the previous state from _prev if stored
        return current.map(p => p.id === prospectData.id && p._prev ? { ...p._prev } : p);
      });
      handleSaveError(prospectData.id, err, currentRep);
    });
  }, [handleSaveError]);

  // Retry uses the rep from when the error occurred, not current rep
  const retrySave = useCallback((id) => {
    const retryRep = errorContext.current[id] || rep;
    clearSaveError(id);
    setProspects((current) => {
      const prospect = current.find((p) => p.id === id);
      if (prospect) {
        saveProspect({ ...prospect, rep: retryRep }).catch((err) => handleSaveError(id, err, retryRep));
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
    saveProspect({ ...newProspect, rep }).catch((err) => {
      // Rollback: remove the optimistically added prospect
      setProspects((current) => current.filter(p => p.id !== newProspect.id));
      handleSaveError(newProspect.id, err, rep);
    });
    return newProspect;
  }, [rep, handleSaveError]);

  // Debounced save for field updates (ranking, next step, etc.)
  const debouncedSave = useCallback((id, prospectData) => {
    if (debounceTimers.current[id]) clearTimeout(debounceTimers.current[id]);
    debounceTimers.current[id] = setTimeout(() => {
      saveProspect({ ...prospectData, rep }).catch((err) => handleSaveError(id, err, rep));
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
      const original = prev.find(p => p.id === id);
      const next = prev.map((p) => (p.id === id ? { ...p, status: 'removed', _prev: original, _existed: true } : p));
      const updated = next.find((p) => p.id === id);
      if (updated) {
        saveProspect({ ...updated, rep }).catch((err) => {
          // Rollback: restore original status
          setProspects((current) => current.map(p => p.id === id ? { ...original } : p));
          handleSaveError(id, err, rep);
        });
      }
      return next;
    });
  }, [rep, handleSaveError]);

  const markSold = useCallback((id) => {
    setProspects((prev) => {
      const original = prev.find(p => p.id === id);
      const next = prev.map((p) => (p.id === id ? { ...p, status: 'sold', _prev: original, _existed: true } : p));
      const updated = next.find((p) => p.id === id);
      if (updated) {
        saveProspect({ ...updated, rep }).catch((err) => {
          // Rollback: restore original status
          setProspects((current) => current.map(p => p.id === id ? { ...original } : p));
          handleSaveError(id, err, rep);
        });
      }
      return next;
    });
  }, [rep, handleSaveError]);

  const reaffirmProspect = useCallback((id) => {
    const now = new Date().toISOString();
    setProspects((prev) => {
      const original = prev.find(p => p.id === id);
      const next = prev.map((p) => (p.id === id ? { ...p, lastReaffirmedAt: now } : p));
      const updated = next.find((p) => p.id === id);
      if (updated) {
        saveProspect({ ...updated, rep }).catch((err) => {
          setProspects((current) => current.map(p => p.id === id ? { ...original } : p));
          handleSaveError(id, err, rep);
        });
      }
      return next;
    });
  }, [rep, handleSaveError]);

  return { prospects, loading, fetchError, saveErrors, addProspect, updateProspect, removeProspect, markSold, reaffirmProspect, retrySave };
}
