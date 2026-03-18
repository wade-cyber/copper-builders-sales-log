import { useState, useCallback } from 'react';
import Header from './components/Header';
import RepSelector from './components/RepSelector';
import CommunityBlock from './components/CommunityBlock';
import SubmitScreen from './components/SubmitScreen';
import { useAssignments } from './hooks/useAssignments';
import { useProspects } from './hooks/useProspects';
import { submitReport } from './utils/api';
import { getWeekEndingShort } from './utils/dates';

function SectionLabel({ children }) {
  return <div className="section-label">{children}</div>;
}

export default function App() {
  const [selectedRep, setSelectedRep] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [appointments, setAppointments] = useState({});

  const { assignments, loading: assignmentsLoading } = useAssignments(selectedRep);
  const { prospects, addProspect, updateProspect, removeProspect, markSold } =
    useProspects(selectedRep);

  const handleRepChange = useCallback((rep) => {
    setSelectedRep(rep);
    setSubmitted(false);
    setAppointments({});
  }, []);

  const handleAppointmentChange = useCallback((communityName, grid) => {
    setAppointments((prev) => ({ ...prev, [communityName]: grid }));
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const allAssignments = [
        ...assignments.communities,
        ...assignments.singleHomes,
        ...assignments.boyl,
        ...assignments.renovations,
      ];

      for (const a of allAssignments) {
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
      <>
        <Header />
        <SubmitScreen />
      </>
    );
  }

  const hasAssignments =
    assignments.communities.length +
    assignments.singleHomes.length +
    assignments.boyl.length +
    assignments.renovations.length > 0;

  function renderSection(label, items, type) {
    if (!items.length) return null;
    return (
      <>
        <SectionLabel>{label}</SectionLabel>
        {items.map((a) => {
          const name = a.name || a.assignmentName;
          return (
            <CommunityBlock
              key={name}
              name={name}
              type={type}
              prospects={prospects}
              appointments={appointments[name] || [[0,0,0],[0,0,0],[0,0,0]]}
              onAppointmentChange={(grid) => handleAppointmentChange(name, grid)}
              onProspectUpdate={updateProspect}
              onAddProspect={addProspect}
              onMarkSold={markSold}
              onRemoveProspect={removeProspect}
            />
          );
        })}
      </>
    );
  }

  return (
    <>
      <Header />
      <RepSelector value={selectedRep} onChange={handleRepChange} />

      {assignmentsLoading && (
        <div style={{ textAlign: 'center', color: 'var(--slate)', padding: 20 }}>
          Loading assignments…
        </div>
      )}

      {selectedRep && !assignmentsLoading && !hasAssignments && (
        <div style={{ textAlign: 'center', color: 'var(--slate)', padding: 20 }}>
          No assignments found for {selectedRep}.
        </div>
      )}

      {renderSection('Communities', assignments.communities, 'community')}
      {renderSection('Single Homes', assignments.singleHomes, 'single-home')}
      {renderSection('Build on Your Lot', assignments.boyl, 'boyl')}
      {renderSection('Renovations', assignments.renovations, 'renovation')}

      {hasAssignments && (
        <div className="submit-bar">
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Submitting…' : 'Submit Weekly Log'}
          </button>
        </div>
      )}
    </>
  );
}
