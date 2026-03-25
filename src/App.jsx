import { useState, useCallback, useMemo, useEffect } from 'react';
import Header from './components/Header';
import RepSelector from './components/RepSelector';
import CommunityBlock from './components/CommunityBlock';
import SubmitScreen from './components/SubmitScreen';
import { useAssignments } from './hooks/useAssignments';
import { useProspects } from './hooks/useProspects';
import { submitWeeklyLog, fetchReps, fetchSubmittedReps } from './utils/api';
import { getWeekEndingShort } from './utils/dates';

export default function App() {
  const [selectedRep, setSelectedRep] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [appointments, setAppointments] = useState({});
  const [directLeads, setDirectLeads] = useState({});
  const [openedBlocks, setOpenedBlocks] = useState(new Set());
  const [collapseKey, setCollapseKey] = useState(0);
  const [reps, setReps] = useState([]);
  const [submittedReps, setSubmittedReps] = useState([]);

  const { assignments, loading: assignmentsLoading, lastSyncedAt } = useAssignments(selectedRep);
  const { prospects, saveErrors, addProspect, updateProspect, removeProspect, markSold, retrySave } =
    useProspects(selectedRep);

  const loadReps = useCallback(() => {
    fetchReps().then((data) => { if (Array.isArray(data)) setReps(data); }).catch(() => {});
    fetchSubmittedReps().then((data) => { if (Array.isArray(data)) setSubmittedReps(data); }).catch(() => {});
  }, []);

  useEffect(() => { loadReps(); }, [loadReps]);

  const handleRepChange = useCallback((rep) => {
    setSelectedRep(rep);
    setSubmitted(false);
    setSubmitError('');
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
      [communityName]: { ...(prev[communityName] || { digital: 0, phoneCall: 0 }), [field]: num },
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
    for (const dl of Object.values(directLeads)) total += (dl.digital || 0) + (dl.phoneCall || 0);
    return total;
  }, [directLeads]);

  const handleSubmit = async () => {
    setSubmitError('');
    setSubmitting(true);
    try {
      const sections = allProjects.map((a) => {
        const name = a.name || a.assignmentName;
        const appts = appointments[name] || [0, 0];
        const blockProspects = prospects.filter(p => p.community === name);
        const dl = directLeads[name] || { digital: 0, phoneCall: 0 };

        return {
          name,
          type: a.assignmentType || 'community',
          market: '',
          appointments: { virtual: appts[0] || 0, inPerson: appts[1] || 0 },
          directLeads: { digital: dl.digital || 0, phoneCall: dl.phoneCall || 0 },
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

      setSubmitted(true);
      fetchSubmittedReps().then((data) => { if (Array.isArray(data)) setSubmittedReps(data); }).catch(() => {});
    } catch (err) {
      setSubmitError('Submission failed — please try again or contact support');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartNew = useCallback(() => {
    setSubmitted(false);
    handleRepChange('');
  }, [handleRepChange]);

  if (submitted) {
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
      <RepSelector value={selectedRep} onChange={handleRepChange}
        reps={reps.filter(r => !submittedReps.includes(r))} />

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
                directLeads={directLeads[cname] || { digital: 0, phoneCall: 0 }}
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
            <div className="totals-card"><div className="totals-label">Leads</div><div className="totals-number">{totalDirectLeads}</div></div>
            <div className="totals-card"><div className="totals-label">Appts</div><div className="totals-number">{totalAppointments}</div></div>
            <div className="totals-card"><div className="totals-label">Sales</div><div className="totals-number">{totalSales}</div></div>
            <div className="totals-card"><div className="totals-label">Prospects</div><div className="totals-number">{totalActiveProspects}</div></div>
          </div>
          <button className="submit-btn" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Weekly Log'}
          </button>
          {submitError && <div className="submit-error">{submitError}</div>}
        </>
      )}
    </div>
  );
}
