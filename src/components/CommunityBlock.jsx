import { useState, useEffect } from 'react';
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
  directLeads,
  onDirectLeadsChange,
  onProspectUpdate,
  onAddProspect,
  onMarkSold,
  onRemoveProspect,
  onOpened,
  forceCollapsed,
  saveErrors,
  onRetrySave,
}) {
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Reset to collapsed when forceCollapsed changes (new rep selected)
  useEffect(() => {
    if (forceCollapsed) {
      setOpen(false);
      setShowForm(false);
    }
  }, [forceCollapsed]);

  const handleToggle = () => {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && onOpened) {
      onOpened(name);
    }
  };

  const communityProspects = prospects.filter((p) => p.community === name);
  const activeProspects = communityProspects.filter((p) => p.status === 'active' || !p.status);
  const apptTotal = appointments.reduce((sum, row) => sum + row.reduce((s, v) => s + v, 0), 0);
  const leadsTotal = (directLeads?.digital || 0) + (directLeads?.phoneCall || 0);

  return (
    <div className="block">
      <div className={`bh${open ? ' open' : ''}`} onClick={handleToggle}>
        <span className="bname">
          {name}
          {isAdded && <span className="added-badge">Added</span>}
        </span>
        <div className="bh-right">
          {apptTotal > 0 && (
            <span className="bh-badge">Appts: {apptTotal}</span>
          )}
          {leadsTotal > 0 && (
            <span className="bh-badge">Leads: {leadsTotal}</span>
          )}
          {activeProspects.length > 0 && (
            <span className="bh-badge">Prospects: {activeProspects.length}</span>
          )}
          <div className="chev">{open ? '−' : '+'}</div>
        </div>
      </div>

      {open && (
        <div className="bb">
          <AppointmentGrid
            type={type}
            values={appointments}
            onChange={onAppointmentChange}
          />

          <div className="divl" />
          <div className="sub">New Lead Received Directly by Sales Person</div>
          <div className="direct-leads">
            <div className="dl-field">
              <label>Digital</label>
              <input
                type="number"
                min="0"
                value={directLeads.digital || 0}
                onChange={(e) => onDirectLeadsChange('digital', e.target.value)}
              />
            </div>
            <div className="dl-field">
              <label>Phone Call</label>
              <input
                type="number"
                min="0"
                value={directLeads.phoneCall || 0}
                onChange={(e) => onDirectLeadsChange('phoneCall', e.target.value)}
              />
            </div>
          </div>

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
                  saveError={saveErrors && saveErrors[p.id]}
                  onRetry={onRetrySave}
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
