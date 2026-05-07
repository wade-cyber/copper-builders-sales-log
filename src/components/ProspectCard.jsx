import { weeksElapsed, needsReaffirmation } from '../utils/dates';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.charAt(0).toUpperCase();
}

export default function ProspectCard({ prospect, onUpdate, onMarkSold, onRemove, onReaffirm, saveError, onRetry }) {
  const isSold = prospect.status === 'sold';
  const isRemoved = prospect.status === 'removed';
  const disabled = isSold || isRemoved;
  const r = (prospect.ranking || 'C').toUpperCase();
  const rankClass = r === 'A' ? 'rank-a' : r === 'B' ? 'rank-b' : 'rank-c';
  const rankLabel = r === 'A' ? 'Hot Lead' : r === 'B' ? 'Warm Lead' : 'Cold Lead';

  const weeks = weeksElapsed(prospect.createdDate);
  const stale = !disabled && needsReaffirmation(prospect.createdDate, prospect.lastReaffirmedAt);

  let cardClass = 'pcard';
  if (isSold) cardClass += ' sold';
  if (isRemoved) cardClass += ' inactive';
  if (stale) cardClass += ' pcard-stale';

  return (
    <div className={cardClass}>
      <div className="pcard-top">
        <div className="pav">{getInitials(prospect.name)}</div>
        <span className="pname">
          {prospect.name}
          {prospect.lotNumber && <span className="pcard-lot"> — Lot {prospect.lotNumber}</span>}
        </span>
        {weeks > 0 && <span className="pcard-age">{weeks}w</span>}
        <div className={`rank-pill ${rankClass}`}>
          <select
            id={`rank-${prospect.id}`}
            value={prospect.ranking || 'C'}
            onChange={(e) => onUpdate(prospect.id, { ranking: e.target.value })}
            disabled={disabled}
            aria-label={rankLabel}
          >
            <option value="A">A — Hot</option>
            <option value="B">B — Warm</option>
            <option value="C">C — Cold</option>
          </select>
        </div>
      </div>

      {saveError && (
        <div className="pcard-save-error">
          <span>Save failed</span>
          <button className="pcard-retry-btn" onClick={() => onRetry(prospect.id)}>Retry</button>
        </div>
      )}

      {isSold && <div className="pcard-sold-msg">Sold — logged as a sale this week</div>}
      {isRemoved && <div className="pcard-removed-msg">Removed — won't carry forward</div>}

      {stale && (
        <div className="pcard-reaffirm">
          <span className="pcard-reaffirm-msg">Still working this prospect?</span>
          <button className="abtn engbtn" onClick={() => onReaffirm(prospect.id)}>Still Engaged</button>
        </div>
      )}

      {!disabled && (
        <div className="pcard-bot pcard-bot-end">
          <div className="pcard-actions pcard-actions-row">
            <button className="abtn sbtn" onClick={() => onMarkSold(prospect.id)} aria-label={`Mark ${prospect.name} as sold`}>Sold</button>
            <button className="abtn rbtn" onClick={() => onRemove(prospect.id)} aria-label={`Remove ${prospect.name}`}>Remove</button>
          </div>
        </div>
      )}
    </div>
  );
}
