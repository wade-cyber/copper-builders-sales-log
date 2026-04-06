import { useState, useCallback, useMemo, useEffect, useReducer } from 'react';
import Header from './components/Header';
import RepSelector from './components/RepSelector';
import CommunityBlock from './components/CommunityBlock';
import SubmitScreen from './components/SubmitScreen';
import { useAssignments } from './hooks/useAssignments';
import { useProspects } from './hooks/useProspects';
import { submitWeeklyLog, fetchReps } from './utils/api';
import { getWeekEndingShort } from './utils/dates';

function submitReducer(state, action) {
  switch (action.type) {
    case 'START': return { submitted: false, submitting: true, error: '' };
    case 'SUCCESS': return { submitted: true, submitting: false, error: '' };
    case 'ERROR': return { submitted: false, submitting: false, error: action.error };
    case 'RESET': return { submitted: false, submitting: false, error: '' };
    default: return state;
  }
}

export default function App() {
  const [selectedRep, setSelectedRep] = useState('');
  const [submit, dispatchSubmit] = useReducer(submitReducer, { submitted: false, submitting: false, error: '' });
  const [appointments, setAppointments] = useState({});
  const [directLeads, setDirectLeads] = useState({});
  const [openedBlocks, setOpenedBlocks] = useState(new Set());
  const [collapseKey, setCollapseKey] = useState(0);
  const [reps, setReps] = useState([]);
  const [repsError, setRepsError] = useState(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [globalError, setGlobalError] = useState(null);

  const { assignments, loading: assignmentsLoading, error: assignmentsError, lastSyncedAt } = useAssignments(selectedRep);
  const { prospects, fetchError: prospectsError, saveErrors, addProspect, updateProspect, removeProspect, markSold, retrySave } =
    useProspects(selectedRep);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => { window.removeEventListener('offline', goOffline); window.removeEventListener('online', goOnline); };
  }, []);

  // Catch unhandled promise rejections
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setGlobalError(e.reason?.message || 'An unexpected error occurred');
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, []);

  // Unsaved changes warning
  useEffect(() => {
    const hasDirty = selectedRep && (Object.keys(appointments).length > 0 || Object.keys(directLeads).length > 0 || openedBlocks.size > 0);
    const handler = (e) => { if (hasDirty && !submit.submitted) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [selectedRep, appointments, directLeads, openedBlocks, submit.submitted]);

  useEffect(() => {
    setRepsError(null);
    fetchReps()
      .then((data) => {
        if (!Array.isArray(data)) return;
        setReps(data);
        // Auto-select rep from URL parameter (?rep=Name)
        const urlRep = new URLSearchParams(window.location.search).get('rep');
        if (urlRep && data.includes(urlRep)) {
          setSelectedRep(urlRep);
        }
      })
      .catch((err) => setRepsError(err.message || 'Failed to load reps'));
  }, []);

  const handleRepChange = useCallback((rep) => {
    setSelectedRep(rep);
    dispatchSubmit({ type: 'RESET' });
    setAppointments({});
    setDirectLeads({});
    setOpenedBlocks(new Set());
    setCollapseKey(k => k + 1);
  }, []);

  const handleAppointmentChange = useCallback((communityName, arr) => {
    setAppointments((prev) => ({ ...prev, [communityName]: arr }));
  }, []);

  const handleDirectLeadsChange = useCallback((communityName, field, value) => {
    const num = Math.max(0, parseInt(value) || 0);
    setDirectLeads((prev) => ({
      ...prev,
      [communityName]: { ...(prev[communityName] || { digital: 0, phoneCall: 0, inPerson: 0 }), [field]: num },
    }));
  }, []);

  const handleBlockOpened = useCallback((blockName) => {
    setOpenedBlocks((prev) => {
      if (prev.has(blockName)) return prev;
      const next = new Set(prev);
      next.add(blockName);
      return next;
    });
  }, []);

  const allProjects = useMemo(() => [
    ...assignments.communities, ...assignments.singleHomes,
  ], [assignments.communities, assignments.singleHomes]);

  const touchedCount = useMemo(() => {
    let count = 0;
    for (const a of allProjects) if (openedBlocks.has(a.name || a.assignmentName)) count++;
    return count;
  }, [allProjects, openedBlocks]);

  const totalAppointments = useMemo(() => {
    let total = 0;
    for (const arr of Object.values(appointments)) total += (arr[0] || 0) + (arr[1] || 0);
    return total;
  }, [appointments]);

  const totalActiveProspects = useMemo(() =>
    prospects.filter(p => p.status === 'active' || !p.status).length, [prospects]);

  const totalSales = useMemo(() =>
    prospects.filter(p => p.status === 'sold').length, [prospects]);

  const totalDirectLeads = useMemo(() => {
    let total = 0;
    for (const dl of Object.values(directLeads)) total += (dl.digital || 0) + (dl.phoneCall || 0) + (dl.inPerson || 0);
    return total;
  }, [directLeads]);

  const handleSubmit = async () => {
    dispatchSubmit({ type: 'START' });
    try {
      const sections = allProjects.map((a) => {
        const name = a.name || a.assignmentName;
        const appts = appointments[name] || [0, 0];
        const blockProspects = prospects.filter(p => p.community === name);
        const dl = directLeads[name] || { digital: 0, phoneCall: 0, inPerson: 0 };

        return {
          name,
          type: a.assignmentType || 'community',
          market: '',
          appointments: { virtual: appts[0] || 0, inPerson: appts[1] || 0 },
          directLeads: { digital: dl.digital || 0, phoneCall: dl.phoneCall || 0, inPerson: dl.inPerson || 0 },
          totalAppointments: (appts[0] || 0) + (appts[1] || 0),
          prospects: blockProspects.map(p => ({
            name: p.name, ranking: p.ranking || 'C', nextStep: '', status: p.status || 'active',
          })),
        };
      });

      await submitWeeklyLog({
        repName: selectedRep,
        weekEnding: getWeekEndingShort(),
        timestamp: new Date().toISOString(),
        sections,
        totals: { totalAppointments, totalProspects: totalActiveProspects },
      });

      dispatchSubmit({ type: 'SUCCESS' });
    } catch (err) {
      dispatchSubmit({ type: 'ERROR', error: err.message || 'Submission failed — please try again or contact support' });
    }
  };

  const handleStartNew = useCallback(() => {
    dispatchSubmit({ type: 'RESET' });
    handleRepChange('');
  }, [handleRepChange]);

  if (submit.submitted) {
    return (
      <div className="shell">
        <Header />
        <SubmitScreen
          repName={selectedRep}
          totalAppointments={totalAppointments}
          totalDirectLeads={totalDirectLeads}
          totalProspects={totalActiveProspects}
          totalSales={totalSales}
          onStartNew={handleStartNew}
        />
      </div>
    );
  }

  const showSections = selectedRep && !assignmentsLoading;

  return (
    <div className="shell">
      <Header />

      {offline && <div className="submit-error" style={{marginBottom:8}}>You are offline. Changes will not be saved.</div>}
      {globalError && <div className="submit-error" style={{marginBottom:8,cursor:'pointer'}} onClick={() => setGlobalError(null)}>{globalError} (tap to dismiss)</div>}
      {repsError && <div className="submit-error" style={{marginBottom:8,cursor:'pointer'}} onClick={() => { setRepsError(null); fetchReps().then(d => { if (Array.isArray(d)) setReps(d); }).catch(e => setRepsError(e.message)); }}>Failed to load reps. Tap to retry.</div>}

      <RepSelector value={selectedRep} onChange={handleRepChange} reps={reps} />

      {assignmentsError && <div className="submit-error" style={{marginBottom:8}}>Failed to load assignments: {assignmentsError}</div>}
      {prospectsError && <div className="submit-error" style={{marginBottom:8}}>Could not load prospects: {prospectsError}</div>}

      {selectedRep && lastSyncedAt && (Date.now() - lastSyncedAt.getTime()) > 8 * 24 * 60 * 60 * 1000 && (
        <div className="stale-warning">
          Assignment data is over a week old (last synced {lastSyncedAt.toLocaleDateString()}). Contact your admin to re-sync.
        </div>
      )}

      {showSections && (
        <div className="pbar">
          <div className="pbar-f" style={{ width: `${allProjects.length > 0 ? Math.round((touchedCount / allProjects.length) * 100) : 0}%` }} />
        </div>
      )}

      {assignmentsLoading && (
        <div style={{ textAlign: 'center', color: 'var(--slate)', padding: 20, fontSize: 13 }}>Loading assignments…</div>
      )}

      {showSections && !allProjects.length && (
        <div style={{ textAlign: 'center', color: 'var(--slate)', padding: 20, fontSize: 13 }}>No assignments found for {selectedRep}.</div>
      )}

      {showSections && (
        <>
          <div className="slabel">Projects</div>
          {allProjects.map((a) => {
            const cname = a.name || a.assignmentName;
            return (
              <CommunityBlock
                key={cname}
                name={cname}
                type={a.assignmentType || 'community'}
                prospects={prospects}
                appointments={appointments[cname] || [0, 0]}
                onAppointmentChange={(arr) => handleAppointmentChange(cname, arr)}
                directLeads={directLeads[cname] || { digital: 0, phoneCall: 0, inPerson: 0 }}
                onDirectLeadsChange={(field, value) => handleDirectLeadsChange(cname, field, value)}
                onProspectUpdate={updateProspect}
                onAddProspect={addProspect}
                onMarkSold={markSold}
                onRemoveProspect={removeProspect}
                onOpened={handleBlockOpened}
                forceCollapsed={collapseKey}
                saveErrors={saveErrors}
                onRetrySave={retrySave}
              />
            );
          })}
        </>
      )}

      {showSections && (
        <>
          <div className="sdiv" />
          <div className="totals-bar totals-bar-4">
            <div className="totals-card"><div className="totals-label">Sales</div><div className="totals-number">{totalSales}</div></div>
            <div className="totals-card"><div className="totals-label">Prospects</div><div className="totals-number">{totalActiveProspects}</div></div>
            <div className="totals-card"><div className="totals-label">Appts</div><div className="totals-number">{totalAppointments}</div></div>
            <div className="totals-card"><div className="totals-label">Leads</div><div className="totals-number">{totalDirectLeads}</div></div>
          </div>
          <button className="submit-btn" onClick={handleSubmit} disabled={submit.submitting}>
            {submit.submitting ? 'Submitting…' : 'Submit Weekly Log'}
          </button>
          {submit.error && <div className="submit-error">{submit.error}</div>}
        </>
      )}
    </div>
  );
}
