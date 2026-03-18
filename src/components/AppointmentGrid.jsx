import React from 'react';

const ROWS = ['Client only', 'Realtor + Client', 'Realtor only'];
const COLS = ['Virtual', 'Onsite'];

const TYPE_LABELS = {
  community: 'Model',
  'single-home': 'Home',
  singlehome: 'Home',
  boyl: 'Lot',
  renovation: 'Site',
};

export default function AppointmentGrid({ type, values, onChange }) {
  const colLabel = TYPE_LABELS[type] || 'Model';
  const cols = [...COLS, `@ ${colLabel}`];

  const handleChange = (row, col, val) => {
    const num = Math.max(0, parseInt(val) || 0);
    const next = (values || []).map((r) => [...r]);
    while (next.length < 3) next.push([0, 0, 0]);
    next[row] = [...(next[row] || [0, 0, 0])];
    next[row][col] = num;
    onChange(next);
  };

  const grid = values && values.length === 3 ? values : [[0,0,0],[0,0,0],[0,0,0]];

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate)', marginBottom: 8 }}>
        Appointments this week
      </div>
      <div className="grid-3x3">
        <div />
        {cols.map((c) => <div key={c} className="col-label">{c}</div>)}
        {ROWS.map((rowLabel, ri) => (
          <React.Fragment key={rowLabel}>
            <div className="row-label">{rowLabel}</div>
            {[0, 1, 2].map((ci) => (
              <input
                key={ci}
                type="number"
                min="0"
                value={grid[ri][ci]}
                onChange={(e) => handleChange(ri, ci, e.target.value)}
              />
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
