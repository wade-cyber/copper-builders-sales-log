import { useState, useEffect } from 'react';
import ProspectCard from './ProspectCard';
import AddProspectForm from './AddProspectForm';

export default function CommunityBlock({
  name,
  type,
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

  useEffect(() => {
    if (forceCollapsed) { setOpen(false); setShowForm(false); }
  }, [forceCollapsed]);

  const handleToggle = () => {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && onOpened) onOpened(name);
  };

  const communityProspects = prospects.filter((p) => p.community === name);
  const activeProspects = communityProspects.filter((p) => p.status === 'active' || !p.status);
  const soldProspects = communityProspects.filter((p) => p.status === 'sold');
  const apptTotal = (appointments[0] || 0) + (appointments[1] || 0);
  const leadsTotal = (directLeads?.digital || 0) + (directLeads?.phoneCall || 0);

  return (
    <div className="block">
      <div className={`bh${open ? ' open' : ''}`} onClick={handleToggle}>
        <span className="bname">{name}</span>
        <div className="bh-right">
          {leadsTotal > 0 && <span className="bh-badge">Leads: {leadsTotal}</span>}
          {apptTotal > 0 && <span className="bh-badge">Appts: {apptTotal}</span>}
          {soldProspects.length > 0 && <span className="bh-badge">Sales: {soldProspects.length}</span>}
          {activeProspects.length > 0 && <span className="bh-badge">Prospects: {activeProspects.length}</span>}
          <div className="chev">{open ? '−' : '+'}</div>
        </div>
      </div>

      {open && (
        <div className="bb">
          <div className="sub">New Leads Received by Sales Agent</div>
          <div className="direct-leads">
            <div className="dl-field">
              <label>Digital</label>
              <input type="number" min="0" value={directLeads.digital || 0}
                onChange={(e) => onDirectLeadsChange('digital', e.target.value)} />
            </div>
            <div className="dl-field">
              <label>Phone Call</label>
              <input type="number" min="0" value={directLeads.phoneCall || 0}
                onChange={(e) => onDirectLeadsChange('phoneCall', e.target.value)} />
            </div>
          </div>

          <div className="divl" />
          <div className="sub">Appointments This Week</div>
          <div className="direct-leads">
            <div className="dl-field">
              <label>Virtual</label>
              <input type="number" min="0" value={appointments[0] || 0}
                onChange={(e) => onAppointmentChange([Math.max(0, parseInt(e.target.value) || 0), appointments[1] || 0])} />
            </div>
            <div className="dl-field">
              <label>In Person</label>
              <input type="number" min="0" value={appointments[1] || 0}
                onChange={(e) => onAppointmentChange([appointments[0] || 0, Math.max(0, parseInt(e.target.value) || 0)])} />
            </div>
          </div>

          <div className="divl" />
          <div className="sub">Prospects / Sales</div>
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
            <AddProspectForm onSave={(data) => { onAddProspect({ ...data, community: name }); setShowForm(false); }} />
          ) : (
            <button className="add-link" onClick={() => setShowForm(true)}>+ Add Prospect</button>
          )}
        </div>
      )}
    </div>
  );
}
