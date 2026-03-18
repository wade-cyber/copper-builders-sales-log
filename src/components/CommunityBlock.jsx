import { useState } from 'react';
import AppointmentGrid from './AppointmentGrid';
import ProspectCard from './ProspectCard';
import AddProspectForm from './AddProspectForm';

function Chevron({ open }) {
  return (
    <svg className={`chevron${open ? ' open' : ''}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 8l5 5 5-5" />
    </svg>
  );
}

export default function CommunityBlock({
  name,
  type,
  prospects,
  appointments,
  onAppointmentChange,
  onProspectUpdate,
  onAddProspect,
  onMarkSold,
  onRemoveProspect,
}) {
  const [open, setOpen] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const communityProspects = prospects.filter((p) => p.community === name);

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="collapsible-header" onClick={() => setOpen(!open)}>
        <h3>{name}</h3>
        <Chevron open={open} />
      </div>

      {open && (
        <div className="collapsible-body">
          <AppointmentGrid
            type={type}
            values={appointments}
            onChange={onAppointmentChange}
          />

          {communityProspects.map((p) => (
            <ProspectCard
              key={p.id}
              prospect={p}
              onUpdate={onProspectUpdate}
              onMarkSold={onMarkSold}
              onRemove={onRemoveProspect}
            />
          ))}

          {showForm ? (
            <AddProspectForm
              onSave={(data) => {
                onAddProspect({ ...data, community: name });
                setShowForm(false);
              }}
            />
          ) : (
            <button
              className="add-prospect-toggle"
              onClick={() => setShowForm(true)}
            >
              + Add prospect
            </button>
          )}
        </div>
      )}
    </div>
  );
}
