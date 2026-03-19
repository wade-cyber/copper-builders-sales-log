import { useState, useCallback, useMemo, useEffect } from 'react';
import Header from './components/Header';
import RepSelector from './components/RepSelector';
import CommunityBlock from './components/CommunityBlock';
import SubmitScreen from './components/SubmitScreen';
import { useAssignments } from './hooks/useAssignments';
import { useProspects } from './hooks/useProspects';
import { submitReport, fetchAllCommunities } from './utils/api';
import { getWeekEndingShort } from './utils/dates';

const BOYL_BLOCK = { name: 'BOYL', assignmentName: 'BOYL', assignmentType: 'boyl' };
const RENOVATIONS_BLOCK = { name: 'Renovations', assignmentName: 'Renovations', assignmentType: 'renovation' };

export default function App() {
  const [selectedRep, setSelectedRep] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [appointments, setAppointments] = useState({});
  const [extraCommunities, setExtraCommunities] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerValue, setPickerValue] = useState('');
  const [allKnownCommunities, setAllKnownCommunities] = useState([]);

  const { assignments, loading: assignmentsLoading } = useAssignments(selectedRep);
  const { prospects, addProspect, updateProspect, removeProspect, markSold } =
    useProspects(selectedRep);

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
    setAppointments({});
    setExtraCommunities([]);
    setShowPicker(false);
  }, []);

  const handleAppointmentChange = useCallback((communityName, grid) => {
    setAppointments((prev) => ({ ...prev, [communityName]: grid }));
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
  // Excludes BOYL, Renovations, and added (cross-sell) communities.
  const requiredBlocks = useMemo(() => [
    ...assignments.communities,
    ...assignments.singleHomes,
  ], [assignments.communities, assignments.singleHomes]);

  const touchedCount = useMemo(() => {
    let count = 0;
    for (const a of requiredBlocks) {
      const name = a.name || a.assignmentName;
      const grid = appointments[name];
      const hasAppts = grid && grid.some(row => row.some(v => v > 0));
      const hasProspects = prospects.some(p => p.community === name);
      if (hasAppts || hasProspects) count++;
    }
    return count;
  }, [requiredBlocks, appointments, prospects]);

  const allRequiredTouched = requiredBlocks.length > 0 && touchedCount >= requiredBlocks.length;

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
    setSubmitting(true);
    try {
      for (const a of allBlocks) {
        const name = a.name || a.assignmentName;
        const grid = appointments[name] || [[0,0,0],[0,0,0],[0,0,0]];
        await submitReport({
          rep: selectedRep,
          weekEnding: getWeekEndingShort(),
          community: name,
          sectionType: a.assignmentType || 'community',
          appointments: grid,
        });
      }
      setSubmitted(true);
    } catch (err) {
      alert('Submit failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="shell">
        <Header />
        <SubmitScreen />
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
          onProspectUpdate={updateProspect}
          onAddProspect={addProspect}
          onMarkSold={markSold}
          onRemoveProspect={removeProspect}
        />
      );
    });
  }

  const showSections = selectedRep && !assignmentsLoading;

  return (
    <div className="shell">
      <Header />
      <RepSelector value={selectedRep} onChange={handleRepChange} />

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
          {renderBlocks([BOYL_BLOCK], 'boyl')}
        </>
      )}

      {/* ── Renovations ── */}
      {showSections && (
        <>
          <div className="sdiv" />
          <div className="slabel">Renovations</div>
          {renderBlocks([RENOVATIONS_BLOCK], 'renovation')}
        </>
      )}

      {/* ── Submit ── */}
      {showSections && (
        <>
          <div className="sdiv" />
          <button
            className="submit-btn"
            onClick={handleSubmit}
            disabled={submitting || !allRequiredTouched}
          >
            {submitting ? 'Submitting…' : 'Submit Weekly Log'}
          </button>
        </>
      )}
    </div>
  );
}
