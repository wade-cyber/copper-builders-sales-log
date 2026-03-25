import { useState, useCallback, useMemo, useEffect } from 'react';
import Header from './components/Header';
import RepSelector from './components/RepSelector';
import CommunityBlock from './components/CommunityBlock';
import SubmitScreen from './components/SubmitScreen';
import { useAssignments } from './hooks/useAssignments';
import { useProspects } from './hooks/useProspects';
import { submitWeeklyLog, fetchAllCommunities, fetchReps } from './utils/api';
import { getWeekEndingShort } from './utils/dates';

const BOYL_BLOCK = { name: 'BOYL', assignmentName: 'BOYL', assignmentType: 'boyl' };
const RENOVATIONS_BLOCK = { name: 'Renovations', assignmentName: 'Renovations', assignmentType: 'renovation' };

export default function App() {
  const [selectedRep, setSelectedRep] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [appointments, setAppointments] = useState({});
  const [directLeads, setDirectLeads] = useState({});
  const [extraCommunities, setExtraCommunities] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerValue, setPickerValue] = useState('');
  const [allKnownCommunities, setAllKnownCommunities] = useState([]);
  const [openedBlocks, setOpenedBlocks] = useState(new Set());
  const [collapseKey, setCollapseKey] = useState(0);
  const [boylMarket, setBoylMarket] = useState('');
  const [renovationsMarket, setRenovationsMarket] = useState('');
  const [reps, setReps] = useState([]);

  const { assignments, loading: assignmentsLoading, lastSyncedAt } = useAssignments(selectedRep);
  const { prospects, saveErrors, addProspect, updateProspect, removeProspect, markSold, retrySave } =
    useProspects(selectedRep);

  // Fetch dynamic rep list from Assignments tab
  useEffect(() => {
    fetchReps()
      .then((data) => { if (Array.isArray(data)) setReps(data); })
      .catch(() => {});
  }, []);

  // Fetch all known communities for the dropdown picker
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
    setExtraCommunities([]);
    setShowPicker(false);
    setOpenedBlocks(new Set());
    setCollapseKey(k => k + 1);
    setBoylMarket('');
    setRenovationsMarket('');
  }, []);

  const handleAppointmentChange = useCallback((communityName, grid) => {
    setAppointments((prev) => ({ ...prev, [communityName]: grid }));
  }, []);

  const handleDirectLeadsChange = useCallback((communityName, field, value) => {
    const num = Math.max(0, parseInt(value) || 0);
    setDirectLeads((prev) => ({
      ...prev,
      [communityName]: {
        ...(prev[communityName] || { digital: 0, phoneCall: 0 }),
        [field]: num,
      },
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
    ...extraCommunities,
  ], [assignments.communities, extraCommunities]);

  const allBlocks = useMemo(() => [
    ...allCommunities,
    ...assignments.singleHomes,
    BOYL_BLOCK,
    RENOVATIONS_BLOCK,
  ], [allCommunities, assignments.singleHomes]);

  // Required = Smartsheet communities + Smartsheet single homes only.
  const requiredBlocks = useMemo(() => [
    ...assignments.communities,
    ...assignments.singleHomes,
  ], [assignments.communities, assignments.singleHomes]);

  // A block is "touched" once it has been opened at least once
  const touchedCount = useMemo(() => {
    let count = 0;
    for (const a of requiredBlocks) {
      const name = a.name || a.assignmentName;
      if (openedBlocks.has(name)) count++;
    }
    return count;
  }, [requiredBlocks, openedBlocks]);

  const allRequiredTouched = requiredBlocks.length > 0 && touchedCount >= requiredBlocks.length;

  // Grand totals across all blocks
  const totalAppointments = useMemo(() => {
    let total = 0;
    for (const grid of Object.values(appointments)) {
      for (const row of grid) {
        for (const v of row) total += v;
      }
    }
    return total;
  }, [appointments]);

  const totalActiveProspects = useMemo(() =>
    prospects.filter(p => p.status === 'active' || !p.status).length,
  [prospects]);

  const totalDirectLeads = useMemo(() => {
    let total = 0;
    for (const dl of Object.values(directLeads)) {
      total += (dl.digital || 0) + (dl.phoneCall || 0);
    }
    return total;
  }, [directLeads]);

  // Communities already shown (assigned + added)
  const shownCommunityNames = useMemo(() => {
    const names = new Set();
    for (const a of allCommunities) names.add(a.name || a.assignmentName);
    return names;
  }, [allCommunities]);

  // Available communities for the dropdown (exclude already shown)
  const availableCommunities = useMemo(() =>
    allKnownCommunities.filter(n => !shownCommunityNames.has(n)),
  [allKnownCommunities, shownCommunityNames]);

  const handleAddCommunity = () => {
    if (!pickerValue) return;
    setExtraCommunities(prev => [...prev, {
      name: pickerValue,
      assignmentName: pickerValue,
      assignmentType: 'community',
      isAdded: true,
    }]);
    setPickerValue('');
    setShowPicker(false);
  };

  const handleSubmit = async () => {
    setSubmitError('');

    // Bug 3 fix: require market selection for BOYL/Renovations if appointments > 0
    const boylGrid = appointments['BOYL'] || [[0,0,0],[0,0,0],[0,0,0]];
    const boylTotal = boylGrid.reduce((s, row) => s + row.reduce((a, v) => a + v, 0), 0);
    if (boylTotal > 0 && !boylMarket) {
      setSubmitError('Please select a market for BOYL before submitting.');
      return;
    }
    const renoGrid = appointments['Renovations'] || [[0,0,0],[0,0,0],[0,0,0]];
    const renoTotal = renoGrid.reduce((s, row) => s + row.reduce((a, v) => a + v, 0), 0);
    if (renoTotal > 0 && !renovationsMarket) {
      setSubmitError('Please select a market for Renovations before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const sections = allBlocks.map((a) => {
        const name = a.name || a.assignmentName;
        const grid = appointments[name] || [[0,0,0],[0,0,0],[0,0,0]];
        const blockProspects = prospects.filter(p => p.community === name);
        const gridTotal = grid.reduce((sum, row) => sum + row.reduce((s, v) => s + v, 0), 0);
        const blockType = a.assignmentType || 'community';
        const market = blockType === 'boyl' ? boylMarket : blockType === 'renovation' ? renovationsMarket : '';

        const dl = directLeads[name] || { digital: 0, phoneCall: 0 };

        return {
          name,
          type: blockType,
          market,
          appointments: {
            clientOnly: { virtual: grid[0][0], onsite: grid[0][1], model: grid[0][2] },
            realtorPlusClient: { virtual: grid[1][0], onsite: grid[1][1], model: grid[1][2] },
            realtorOnly: { virtual: grid[2][0], onsite: grid[2][1], model: grid[2][2] },
          },
          directLeads: { digital: dl.digital || 0, phoneCall: dl.phoneCall || 0 },
          totalAppointments: gridTotal,
          prospects: blockProspects.map(p => ({
            name: p.name,
            ranking: p.ranking || 'C',
            nextStep: p.nextStep || '',
            status: p.status || 'active',
          })),
        };
      });

      await submitWeeklyLog({
        repName: selectedRep,
        weekEnding: getWeekEndingShort(),
        timestamp: new Date().toISOString(),
        sections,
        totals: {
          totalAppointments,
          totalProspects: totalActiveProspects,
        },
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
          onStartNew={handleStartNew}
        />
      </div>
    );
  }

  function renderBlocks(items, type) {
    return items.map((a) => {
      const name = a.name || a.assignmentName;
      return (
        <CommunityBlock
          key={name}
          name={name}
          type={type}
          isAdded={!!a.isAdded}
          prospects={prospects}
          appointments={appointments[name] || [[0,0,0],[0,0,0],[0,0,0]]}
          onAppointmentChange={(grid) => handleAppointmentChange(name, grid)}
          directLeads={directLeads[name] || { digital: 0, phoneCall: 0 }}
          onDirectLeadsChange={(field, value) => handleDirectLeadsChange(name, field, value)}
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
    });
  }

  const showSections = selectedRep && !assignmentsLoading;

  return (
    <div className="shell">
      <Header />
      <RepSelector value={selectedRep} onChange={handleRepChange} reps={reps} />

      {selectedRep && lastSyncedAt && (Date.now() - lastSyncedAt.getTime()) > 8 * 24 * 60 * 60 * 1000 && (
        <div className="stale-warning">
          Assignment data is over a week old (last synced {lastSyncedAt.toLocaleDateString()}). Contact your admin to re-sync from Smartsheet.
        </div>
      )}

      {showSections && (
        <div className="pbar">
          <div className="pbar-f" style={{ width: `${requiredBlocks.length > 0 ? Math.round((touchedCount / requiredBlocks.length) * 100) : 0}%` }} />
        </div>
      )}

      {assignmentsLoading && (
        <div style={{ textAlign: 'center', color: 'var(--slate)', padding: 20, fontSize: 13 }}>
          Loading assignments…
        </div>
      )}

      {showSections && !allBlocks.length && extraCommunities.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--slate)', padding: 20, fontSize: 13 }}>
          No assignments found for {selectedRep}.
        </div>
      )}

      {/* ── Communities ── */}
      {showSections && (
        <>
          <div className="slabel">Communities</div>
          {renderBlocks(allCommunities, 'community')}

          {showPicker && (
            <div className="picker-wrap" style={{ display: 'block' }}>
              <div className="picker-row">
                <select
                  value={pickerValue}
                  onChange={(e) => setPickerValue(e.target.value)}
                  style={{ flex: 1, height: 32, border: '1px solid var(--border)', borderRadius: 3, padding: '0 8px', fontSize: 12, background: 'var(--white)', color: 'var(--slate-dark)' }}
                >
                  <option value="">Select a community…</option>
                  {availableCommunities.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
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

      {/* ── Single Homes ── */}
      {showSections && assignments.singleHomes.length > 0 && (
        <>
          <div className="sdiv" />
          <div className="slabel">Single Homes</div>
          {renderBlocks(assignments.singleHomes, 'single-home')}
        </>
      )}

      {/* ── BOYL ── */}
      {showSections && (
        <>
          <div className="sdiv" />
          <div className="slabel">BOYL — Build on Your Lot</div>
          <div className="market-select">
            <label className="market-label">Market</label>
            <select value={boylMarket} onChange={(e) => setBoylMarket(e.target.value)}>
              <option value="">Select market…</option>
              <option value="CLT">CLT</option>
              <option value="TRN">TRN</option>
              <option value="GVL">GVL</option>
            </select>
          </div>
          {renderBlocks([BOYL_BLOCK], 'boyl')}
        </>
      )}

      {/* ── Renovations ── */}
      {showSections && (
        <>
          <div className="sdiv" />
          <div className="slabel">Renovations</div>
          <div className="market-select">
            <label className="market-label">Market</label>
            <select value={renovationsMarket} onChange={(e) => setRenovationsMarket(e.target.value)}>
              <option value="">Select market…</option>
              <option value="CLT">CLT</option>
              <option value="TRN">TRN</option>
              <option value="GVL">GVL</option>
            </select>
          </div>
          {renderBlocks([RENOVATIONS_BLOCK], 'renovation')}
        </>
      )}

      {/* ── Submit ── */}
      {showSections && (
        <>
          <div className="sdiv" />
          <div className="totals-bar totals-bar-3">
            <div className="totals-card">
              <div className="totals-label">Direct Leads</div>
              <div className="totals-number">{totalDirectLeads}</div>
            </div>
            <div className="totals-card">
              <div className="totals-label">Total Appts</div>
              <div className="totals-number">{totalAppointments}</div>
            </div>
            <div className="totals-card">
              <div className="totals-label">Total Prospects</div>
              <div className="totals-number">{totalActiveProspects}</div>
            </div>
          </div>
          <button
            className="submit-btn"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Submitting…' : 'Submit Weekly Log'}
          </button>
          {submitError && (
            <div className="submit-error">{submitError}</div>
          )}
        </>
      )}
    </div>
  );
}
