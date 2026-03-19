const NEXT_STEPS = [
  'Contract appt set',
  'Follow-up call',
  'Send floor plans',
  'Site visit',
  'Financing referral',
  'Waiting on decision',
  'Plans review (BOYL)',
  'Scope review (Renovations)',
];

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.charAt(0).toUpperCase();
}

export default function ProspectCard({ prospect, onUpdate, onMarkSold, onRemove }) {
  const isSold = prospect.status === 'sold';
  const isRemoved = prospect.status === 'removed';
  const disabled = isSold || isRemoved;
  const r = (prospect.ranking || 'C').toUpperCase();
  const rankClass = r === 'A' ? 'rank-a' : r === 'B' ? 'rank-b' : 'rank-c';

  let cardClass = 'pcard';
  if (isSold) cardClass += ' sold';
  if (isRemoved) cardClass += ' inactive';

  return (
    <div className={cardClass}>
      <div className="pcard-top">
        <div className="pav">{getInitials(prospect.name)}</div>
        <span className="pname">{prospect.name}</span>
        <div className={`rank-pill ${rankClass}`}>
          <select
            value={prospect.ranking || 'C'}
            onChange={(e) => onUpdate(prospect.id, { ranking: e.target.value })}
            disabled={disabled}
          >
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
        </div>
      </div>

      {isSold && (
        <div style={{ fontSize: 11, fontWeight: 600, fontStyle: 'italic', color: '#3a5e20', marginTop: 4 }}>
          Sold — won't appear next week
        </div>
      )}
      {isRemoved && (
        <div style={{ fontSize: 11, fontWeight: 600, fontStyle: 'italic', color: '#999', marginTop: 4 }}>
          Removed — won't carry forward
        </div>
      )}

      {!disabled && (
        <div className="pcard-bot">
          <div className="pcard-actions">
            <button className="abtn sbtn" onClick={() => onMarkSold(prospect.id)}>Sold</button>
            <button className="abtn rbtn" onClick={() => onRemove(prospect.id)}>Remove</button>
          </div>
          <div className="ns-wrap">
            <div className="ns-label">Next Step</div>
            <select
              value={prospect.nextStep || ''}
              onChange={(e) => onUpdate(prospect.id, { nextStep: e.target.value })}
            >
              <option value="">Select…</option>
              {NEXT_STEPS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
