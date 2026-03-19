import { REPS } from '../utils/api';

function getInitial(name) {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

export default function RepSelector({ value, onChange }) {
  return (
    <div className="rep-row">
      <div className="rep-av">{value ? getInitial(value) : '?'}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ flex: 1, height: 32, border: '1px solid var(--border)', borderRadius: 3, padding: '0 8px', fontSize: 12, background: 'var(--white)', color: 'var(--slate-dark)' }}
      >
        <option value="">Select your name</option>
        {REPS.map((rep) => (
          <option key={rep} value={rep}>{rep}</option>
        ))}
      </select>
    </div>
  );
}
