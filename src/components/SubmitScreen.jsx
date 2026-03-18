import { getWeekEndingShort } from '../utils/dates';

function GoldCheckmark() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" style={{ display: 'block', margin: '0 auto 16px' }}>
      <circle cx="32" cy="32" r="30" fill="none" stroke="#B09245" strokeWidth="2.5" />
      <path d="M20 33l8 8 16-16" fill="none" stroke="#B09245" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GoldRule() {
  return (
    <div style={{ width: 60, height: 2, background: '#B09245', margin: '16px auto', borderRadius: 1 }} />
  );
}

export default function SubmitScreen() {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <GoldCheckmark />
      <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: '1.4rem', fontWeight: 700, color: 'var(--slate-dark)' }}>
        Copper Builders
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, marginTop: 12, color: 'var(--slate-dark)' }}>
        Log submitted
      </div>
      <GoldRule />
      <div style={{ fontSize: 14, color: 'var(--slate)', marginTop: 8 }}>
        Week ending {getWeekEndingShort()}
      </div>
      <div style={{ fontSize: 13, color: 'var(--slate)', marginTop: 16, fontStyle: 'italic' }}>
        Your report has been recorded. See you Monday.
      </div>
    </div>
  );
}
