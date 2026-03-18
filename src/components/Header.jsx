import { getWeekEnding } from '../utils/dates';

function GoldKeyDivider() {
  return (
    <svg viewBox="0 0 300 20" width="260" height="20" style={{ display: 'block', margin: '8px auto' }}>
      <line x1="0" y1="10" x2="120" y2="10" stroke="#B09245" strokeWidth="1" />
      <line x1="180" y1="10" x2="300" y2="10" stroke="#B09245" strokeWidth="1" />
      <g transform="translate(150,10)" fill="#B09245">
        <circle cx="0" cy="-4" r="4" />
        <rect x="-1.5" y="-4" width="3" height="12" rx="1" />
        <rect x="-5" y="4" width="10" height="3" rx="1" />
      </g>
    </svg>
  );
}

export default function Header() {
  return (
    <header style={{ textAlign: 'center', padding: '24px 0 8px' }}>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', right: 0, top: 0, textAlign: 'right', fontSize: 11, color: 'var(--slate)' }}>
          <div>Reporting through</div>
          <div style={{ fontWeight: 600 }}>{getWeekEnding()}</div>
        </div>
        <h1 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: '1.6rem', margin: 0 }}>
          Copper Builders
        </h1>
        <div style={{ fontFamily: "'Libre Baskerville', serif", fontStyle: 'italic', color: 'var(--gold)', fontSize: 13, marginTop: 2 }}>
          Built on Trust
        </div>
      </div>
      <GoldKeyDivider />
      <h2 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: '1.1rem', marginTop: 4 }}>
        Weekly Sales Log
      </h2>
      <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 2 }}>
        Reports due Mondays
      </div>
    </header>
  );
}
