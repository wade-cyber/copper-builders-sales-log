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

export default function ProspectCard({ prospect, onUpdate, onMarkSold, onRemove }) {
  const isSold = prospect.status === 'sold';
  const isRemoved = prospect.status === 'removed';
  const disabled = isSold || isRemoved;

  const cardClass = `card${isSold ? ' sold' : ''}${isRemoved ? ' removed' : ''}`;

  return (
    <div className={cardClass}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span className={`ranking-badge ${(prospect.ranking || 'c').toLowerCase()}`}>
          {(prospect.ranking || 'C').toUpperCase()}
        </span>
        <strong style={{ flex: 1, fontSize: 14 }}>{prospect.name}</strong>
      </div>

      <div className="prospect-row">
        <select
          value={prospect.ranking || 'C'}
          onChange={(e) => onUpdate(prospect.id, { ranking: e.target.value })}
          disabled={disabled}
          style={{ width: 70, flex: 'none' }}
        >
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
        </select>
        <select
          value={prospect.nextStep || ''}
          onChange={(e) => onUpdate(prospect.id, { nextStep: e.target.value })}
          disabled={disabled}
        >
          <option value="">Next step…</option>
          {NEXT_STEPS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {isSold && <div className="stamp sold">Sold — won't appear next week</div>}
      {isRemoved && <div className="stamp removed">Removed — won't carry forward</div>}

      {!disabled && (
        <div className="prospect-actions">
          <button className="btn-sold btn-small" onClick={() => onMarkSold(prospect.id)}>
            Sold
          </button>
          <button className="btn-remove btn-small" onClick={() => onRemove(prospect.id)}>
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
