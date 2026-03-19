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
  const activeProspects = communityProspects.filter((p) => p.status === 'active' || !p.status);
  const apptTotal = appointments.reduce((sum, row) => sum + row.reduce((s, v) => s + v, 0), 0);
  const hasStats = apptTotal > 0 || activeProspects.length > 0;

  return (
    <div className="block">
      <div className={`bh${open ? ' open' : ''}`} onClick={() => setOpen(!open)}>
        <div className="bname-wrap">
          <span className="bname">
            {name}
            {isAdded && <span className="added-badge">Added</span>}
          </span>
          {hasStats && (
            <span className="block-stats">
              {apptTotal} appt{apptTotal !== 1 ? 's' : ''} / {activeProspects.length} prospect{activeProspects.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
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
