import { useState } from 'react';
import AppointmentGrid from './AppointmentGrid';
import ProspectCard from './ProspectCard';
import AddProspectForm from './AddProspectForm';

export default function CommunityBlock({
  name,
  type,
  isAdded,
  prospects,
  appointments,
  onAppointmentChange,
  onProspectUpdate,
  onAddProspect,
  onMarkSold,
  onRemoveProspect,
}) {
  const startCollapsed = type === 'boyl' || type === 'renovation';
  const [open, setOpen] = useState(!startCollapsed);
  const [showForm, setShowForm] = useState(false);

  const communityProspects = prospects.filter((p) => p.community === name);

  return (
    <div className="block">
      <div className={`bh${open ? ' open' : ''}`} onClick={() => setOpen(!open)}>
        <span className="bname">
          {name}
          {isAdded && <span className="added-badge">Added</span>}
        </span>
        <div className="chev">{open ? '−' : '+'}</div>
      </div>

      {open && (
        <div className="bb">
          <AppointmentGrid
            type={type}
            values={appointments}
            onChange={onAppointmentChange}
          />

          <div className="divl" />
          <div className="sub">Prospects</div>

          {communityProspects.length > 0 && (
            <div className="plist">
              {communityProspects.map((p) => (
                <ProspectCard
                  key={p.id}
                  prospect={p}
                  onUpdate={onProspectUpdate}
                  onMarkSold={onMarkSold}
                  onRemove={onRemoveProspect}
                />
              ))}
            </div>
          )}

          {showForm ? (
            <AddProspectForm
              onSave={(data) => {
                onAddProspect({ ...data, community: name });
                setShowForm(false);
              }}
            />
          ) : (
            <button
              className="add-link"
              onClick={() => setShowForm(true)}
            >
              + Add Prospect
            </button>
          )}
        </div>
      )}
    </div>
  );
}
