import React from 'react';

const ROWS = ['Client only', 'Realtor + Client', 'Realtor only'];
const COLS = ['Virtual', 'In Person'];

export default function AppointmentGrid({ values, onChange }) {
  const handleChange = (row, col, val) => {
    const num = Math.max(0, parseInt(val) || 0);
    const next = (values || []).map((r) => [...r]);
    while (next.length < 3) next.push([0, 0]);
    next[row] = [...(next[row] || [0, 0])];
    next[row][col] = num;
    onChange(next);
  };

  const grid = values && values.length === 3 ? values : [[0,0],[0,0],[0,0]];

  return (
    <>
      <div className="sub">Appointments This Week</div>
      <div className="ag">
        <div className="agh" style={{ background: 'transparent', border: 'none' }} />
        {COLS.map((c) => <div key={c} className="agh">{c}</div>)}
        {ROWS.map((rowLabel, ri) => (
          <React.Fragment key={rowLabel}>
            <div className="agrl">{rowLabel}</div>
            {[0, 1].map((ci) => (
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
