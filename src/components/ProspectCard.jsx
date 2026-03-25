function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.charAt(0).toUpperCase();
}

export default function ProspectCard({ prospect, onUpdate, onMarkSold, onRemove, saveError, onRetry }) {
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

      {saveError && (
        <div style={{ fontSize: 11, fontWeight: 600, color: '#c0392b', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>Save failed</span>
          <button
            onClick={() => onRetry(prospect.id)}
            style={{ fontSize: 10, padding: '1px 6px', border: '1px solid #c0392b', borderRadius: 3, background: 'transparent', color: '#c0392b', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      )}

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
        <div className="pcard-bot" style={{ justifyContent: 'flex-end' }}>
          <div className="pcard-actions" style={{ flexDirection: 'row', gap: 6 }}>
            <button className="abtn sbtn" onClick={() => onMarkSold(prospect.id)}>Sold</button>
            <button className="abtn rbtn" onClick={() => onRemove(prospect.id)}>Remove</button>
          </div>
        </div>
      )}
    </div>
  );
}
