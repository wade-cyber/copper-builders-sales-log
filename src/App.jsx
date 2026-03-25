import { useState, useCallback, useMemo, useEffect } from 'react';
import Header from './components/Header';
import RepSelector from './components/RepSelector';
import CommunityBlock from './components/CommunityBlock';
import SubmitScreen from './components/SubmitScreen';
import { useAssignments } from './hooks/useAssignments';
import { useProspects } from './hooks/useProspects';
import { submitWeeklyLog, fetchAllCommunities, fetchReps } from './utils/api';
import { getWeekEndingShort } from './utils/dates';

export default function App() {
  const [selectedRep, setSelectedRep] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [appointments, setAppointments] = useState({});
  const [directLeads, setDirectLeads] = useState({});
  const [thirdPartyLeads, setThirdPartyLeads] = useState({});
  const [sales, setSales] = useState({});
  const [extraCommunities, setExtraCommunities] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerValue, setPickerValue] = useState('');
  const [allKnownCommunities, setAllKnownCommunities] = useState([]);
  const [openedBlocks, setOpenedBlocks] = useState(new Set());
  const [collapseKey, setCollapseKey] = useState(0);
  const [reps, setReps] = useState([]);

  const { assignments, loading: assignmentsLoading, lastSyncedAt } = useAssignments(selectedRep);
  const { prospects, saveErrors, addProspect, updateProspect, removeProspect, markSold, retrySave } =
    useProspects(selectedRep);

  useEffect(() => {
    fetchReps()
      .then((data) => { if (Array.isArray(data)) setReps(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchAllCommunities()
      .then((data) => {
        const names = (Array.isArray(data) ? data : []).map(a => a.name || a.assignmentName);
        setAllKnownCommunities(names);
      })
      .catch(() => {});
  }, []);

  const handleRepChange = useCallback((rep) => {
    setSelectedRep(rep);
    setSubmitted(false);
    setSubmitError('');
    setAppointments({});
    setDirectLeads({});
    setThirdPartyLeads({});
    setSales({});
    setExtraCommunities([]);
    setShowPicker(false);
    setOpenedBlocks(new Set());
    setCollapseKey(k => k + 1);
  }, []);

  const handleAppointmentChange = useCallback((communityName, grid) => {
    setAppointments((prev) => ({ ...prev, [communityName]: grid }));
  }, []);

  const handleDirectLeadsChange = useCallback((communityName, field, value) => {
    const num = Math.max(0, parseInt(value) || 0);
    setDirectLeads((prev) => ({
      ...prev,
      [communityName]: { ...(prev[communityName] || { digital: 0, phoneCall: 0 }), [field]: num },
    }));
  }, []);

  const handleThirdPartyLeadsChange = useCallback((communityName, field, value) => {
    const num = Math.max(0, parseInt(value) || 0);
    setThirdPartyLeads((prev) => ({
      ...prev,
      [communityName]: { ...(prev[communityName] || { digital: 0, inPerson: 0, callIn: 0 }), [field]: num },
    }));
  }, []);

  const handleAddSale = useCallback((communityName, sale) => {
    setSales((prev) => ({
      ...prev,
      [communityName]: [...(prev[communityName] || []), sale],
    }));
  }, []);

  const handleRemoveSale = useCallback((communityName, index) => {
    setSales((prev) => ({
      ...prev,
      [communityName]: (prev[communityName] || []).filter((_, i) => i !== index),
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

  const allCommunities = useMemo(() => [
    ...assignments.communities,
    ...assignments.singleHomes,
    ...extraCommunities,
  ], [assignments.communities, assignments.singleHomes, extraCommunities]);

  const requiredBlocks = useMemo(() => [
    ...assignments.communities,
    ...assignments.singleHomes,
  ], [assignments.communities, assignments.singleHomes]);

  const touchedCount = useMemo(() => {
    let count = 0;
    for (const a of requiredBlocks) {
      if (openedBlocks.has(a.name || a.assignmentName)) count++;
    }
    return count;
  }, [requiredBlocks, openedBlocks]);

  const totalAppointments = useMemo(() => {
    let total = 0;
    for (const grid of Object.values(appointments)) {
      for (const row of grid) for (const v of row) total += v;
    }
    return total;
  }, [appointments]);

  const totalActiveProspects = useMemo(() =>
    prospects.filter(p => p.status === 'active' || !p.status).length, [prospects]);

  const totalDirectLeads = useMemo(() => {
    let total = 0;
    for (const dl of Object.values(directLeads)) total += (dl.digital || 0) + (dl.phoneCall || 0);
    return total;
  }, [directLeads]);

  const totalSales = useMemo(() => {
    let total = 0;
    for (const arr of Object.values(sales)) total += arr.length;
    return total;
  }, [sales]);

  const shownCommunityNames = useMemo(() => {
    const names = new Set();
    for (const a of allCommunities) names.add(a.name || a.assignmentName);
    return names;
  }, [allCommunities]);

  const availableCommunities = useMemo(() =>
    allKnownCommunities.filter(n => !shownCommunityNames.has(n)),
  [allKnownCommunities, shownCommunityNames]);

  const handleAddCommunity = () => {
    if (!pickerValue) return;
    setExtraCommunities(prev => [...prev, {
      name: pickerValue, assignmentName: pickerValue, assignmentType: 'community', isAdded: true,
    }]);
    setPickerValue('');
    setShowPicker(false);
  };

  const handleSubmit = async () => {
    setSubmitError('');
    setSubmitting(true);
    try {
      const sections = allCommunities.map((a) => {
        const name = a.name || a.assignmentName;
        const grid = appointments[name] || [[0,0],[0,0],[0,0]];
        const blockProspects = prospects.filter(p => p.community === name);
        const gridTotal = grid.reduce((sum, row) => sum + row.reduce((s, v) => s + v, 0), 0);
        const dl = directLeads[name] || { digital: 0, phoneCall: 0 };
        const tp = thirdPartyLeads[name] || { digital: 0, inPerson: 0, callIn: 0 };
        const commSales = sales[name] || [];

        return {
          name,
          type: a.assignmentType || 'community',
          market: '',
          appointments: {
            clientOnly: { virtual: grid[0][0], inPerson: grid[0][1] },
            realtorPlusClient: { virtual: grid[1][0], inPerson: grid[1][1] },
            realtorOnly: { virtual: grid[2][0], inPerson: grid[2][1] },
          },
          directLeads: { digital: dl.digital || 0, phoneCall: dl.phoneCall || 0 },
          thirdPartyLeads: { digital: tp.digital || 0, inPerson: tp.inPerson || 0, callIn: tp.callIn || 0 },
          sales: commSales,
          totalAppointments: gridTotal,
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
      <RepSelector value={selectedRep} onChange={handleRepChange} reps={reps} />

      {selectedRep && lastSyncedAt && (Date.now() - lastSyncedAt.getTime()) > 8 * 24 * 60 * 60 * 1000 && (
        <div className="stale-warning">
          Assignment data is over a week old (last synced {lastSyncedAt.toLocaleDateString()}). Contact your admin to re-sync.
        </div>
      )}

      {showSections && (
        <div className="pbar">
          <div className="pbar-f" style={{ width: `${requiredBlocks.length > 0 ? Math.round((touchedCount / requiredBlocks.length) * 100) : 0}%` }} />
        </div>
      )}

      {assignmentsLoading && (
        <div style={{ textAlign: 'center', color: 'var(--slate)', padding: 20, fontSize: 13 }}>Loading assignments…</div>
      )}

      {showSections && !allCommunities.length && (
        <div style={{ textAlign: 'center', color: 'var(--slate)', padding: 20, fontSize: 13 }}>No assignments found for {selectedRep}.</div>
      )}

      {showSections && (
        <>
          <div className="slabel">Communities</div>
          {allCommunities.map((a) => {
            const cname = a.name || a.assignmentName;
            return (
              <CommunityBlock
                key={cname}
                name={cname}
                type={a.assignmentType || 'community'}
                isAdded={!!a.isAdded}
                thirdParty={a.thirdParty || ''}
                prospects={prospects}
                appointments={appointments[cname] || [[0,0],[0,0],[0,0]]}
                onAppointmentChange={(grid) => handleAppointmentChange(cname, grid)}
                directLeads={directLeads[cname] || { digital: 0, phoneCall: 0 }}
                onDirectLeadsChange={(field, value) => handleDirectLeadsChange(cname, field, value)}
                thirdPartyLeads={thirdPartyLeads[cname] || { digital: 0, inPerson: 0, callIn: 0 }}
                onThirdPartyLeadsChange={(field, value) => handleThirdPartyLeadsChange(cname, field, value)}
                sales={sales[cname] || []}
                onAddSale={(sale) => handleAddSale(cname, sale)}
                onRemoveSale={(idx) => handleRemoveSale(cname, idx)}
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

          {showPicker && (
            <div className="picker-wrap" style={{ display: 'block' }}>
              <div className="picker-row">
                <select value={pickerValue} onChange={(e) => setPickerValue(e.target.value)}
                  style={{ flex: 1, height: 32, border: '1px solid var(--border)', borderRadius: 3, padding: '0 8px', fontSize: 12, background: 'var(--white)', color: 'var(--slate-dark)' }}>
                  <option value="">Select a community…</option>
                  {availableCommunities.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <button className="picker-add-btn" onClick={handleAddCommunity} disabled={!pickerValue}>Add</button>
              </div>
            </div>
          )}

          <button className="add-comm-btn" onClick={() => setShowPicker(!showPicker)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="#B09245" strokeWidth="1.2"/>
              <line x1="7" y1="4" x2="7" y2="10" stroke="#B09245" strokeWidth="1.2"/>
              <line x1="4" y1="7" x2="10" y2="7" stroke="#B09245" strokeWidth="1.2"/>
            </svg>
            Add Community
          </button>
        </>
      )}

      {showSections && (
        <>
          <div className="sdiv" />
          <div className="totals-bar totals-bar-4">
            <div className="totals-card">
              <div className="totals-label">Leads</div>
              <div className="totals-number">{totalDirectLeads}</div>
            </div>
            <div className="totals-card">
              <div className="totals-label">Appts</div>
              <div className="totals-number">{totalAppointments}</div>
            </div>
            <div className="totals-card">
              <div className="totals-label">Sales</div>
              <div className="totals-number">{totalSales}</div>
            </div>
            <div className="totals-card">
              <div className="totals-label">Prospects</div>
              <div className="totals-number">{totalActiveProspects}</div>
            </div>
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
