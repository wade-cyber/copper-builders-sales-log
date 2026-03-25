import { useState, useEffect } from 'react';
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
  sales,
  onAddSale,
  onRemoveSale,
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
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [saleClient, setSaleClient] = useState('');
  const [saleLot, setSaleLot] = useState('');

  useEffect(() => {
    if (forceCollapsed) {
      setOpen(false);
      setShowForm(false);
      setShowSaleForm(false);
    }
  }, [forceCollapsed]);

  const handleToggle = () => {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && onOpened) onOpened(name);
  };

  const handleAddSale = () => {
    if (!saleClient.trim()) return;
    onAddSale({ clientName: saleClient.trim(), lotNumber: saleLot.trim() });
    setSaleClient('');
    setSaleLot('');
    setShowSaleForm(false);
  };

  const communityProspects = prospects.filter((p) => p.community === name);
  const activeProspects = communityProspects.filter((p) => p.status === 'active' || !p.status);
  const apptTotal = (appointments[0] || 0) + (appointments[1] || 0);
  const leadsTotal = (directLeads?.digital || 0) + (directLeads?.phoneCall || 0);

  return (
    <div className="block">
      <div className={`bh${open ? ' open' : ''}`} onClick={handleToggle}>
        <span className="bname">
          {name}
          {isAdded && <span className="added-badge">Added</span>}
        </span>
        <div className="bh-right">
          {leadsTotal > 0 && <span className="bh-badge">Leads: {leadsTotal}</span>}
          {apptTotal > 0 && <span className="bh-badge">Appts: {apptTotal}</span>}
          {(sales || []).length > 0 && <span className="bh-badge">Sales: {sales.length}</span>}
          {activeProspects.length > 0 && <span className="bh-badge">Prospects: {activeProspects.length}</span>}
          <div className="chev">{open ? '−' : '+'}</div>
        </div>
      </div>

      {open && (
        <div className="bb">
          {/* Leads */}
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

          {/* Appointments */}
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

          {/* Sales */}
          <div className="divl" />
          <div className="sub">Sales This Week</div>
          {(sales || []).length > 0 && (
            <div className="sales-list">
              {sales.map((s, i) => (
                <div key={i} className="sale-row">
                  <span className="sale-info">{s.clientName}{s.lotNumber ? ` — Lot ${s.lotNumber}` : ''}</span>
                  <button className="sale-remove" onClick={() => onRemoveSale(i)}>×</button>
                </div>
              ))}
            </div>
          )}
          {showSaleForm ? (
            <div className="nf">
              <div className="nf-r3">
                <div className="nf-field" style={{ gridColumn: 'span 2' }}>
                  <label>Client Name</label>
                  <input type="text" value={saleClient} onChange={(e) => setSaleClient(e.target.value)} placeholder="Client name" />
                </div>
                <div className="nf-field">
                  <label>Lot #</label>
                  <input type="text" value={saleLot} onChange={(e) => setSaleLot(e.target.value)} placeholder="Lot number" />
                </div>
              </div>
              <button className="save-btn" onClick={handleAddSale} disabled={!saleClient.trim()}>Add Sale</button>
            </div>
          ) : (
            <button className="add-link" onClick={() => setShowSaleForm(true)}>+ Add Sale</button>
          )}

          {/* Prospects */}
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
            <AddProspectForm onSave={(data) => { onAddProspect({ ...data, community: name }); setShowForm(false); }} />
          ) : (
            <button className="add-link" onClick={() => setShowForm(true)}>+ Add Prospect</button>
          )}
        </div>
      )}
    </div>
  );
}
