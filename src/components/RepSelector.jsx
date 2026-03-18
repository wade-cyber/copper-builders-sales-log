import { REPS } from '../utils/api';

function getInitials(name) {
  if (!name) return '?';
  return name.slice(0, 2).toUpperCase();
}

export default function RepSelector({ value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
      <div className="avatar">{value ? getInitials(value) : '?'}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ flex: 1 }}
      >
        <option value="">Select your name</option>
        {REPS.map((rep) => (
          <option key={rep} value={rep}>{rep}</option>
        ))}
      </select>
    </div>
  );
}
