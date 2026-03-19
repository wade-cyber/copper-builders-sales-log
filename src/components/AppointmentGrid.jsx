import React from 'react';

const ROWS = ['Client only', 'Realtor + Client', 'Realtor only'];
const COLS = ['Virtual', 'Onsite'];

const TYPE_LABELS = {
  community: 'Model',
  'single-home': 'Home',
  singlehome: 'Home',
  boyl: 'Lot',
  renovation: 'Home',
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
    <>
      <div className="sub">Appointments This Week</div>
      <div className="ag">
        {/* Header row */}
        <div className="agh" style={{ background: 'transparent', border: 'none' }} />
        {cols.map((c) => <div key={c} className="agh">{c}</div>)}
        {/* Data rows */}
        {ROWS.map((rowLabel, ri) => (
          <React.Fragment key={rowLabel}>
            <div className="agrl">{rowLabel}</div>
            {[0, 1, 2].map((ci) => (
              <div key={ci} className="agc">
                <input
                  className="agi"
                  type="number"
                  min="0"
                  value={grid[ri][ci]}
                  onChange={(e) => handleChange(ri, ci, e.target.value)}
                />
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </>
  );
}
