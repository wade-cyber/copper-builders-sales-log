import { getWeekEndingShort } from '../utils/dates';

function KeySvg() {
  return (
    <svg width="18" height="10" viewBox="0 0 18 10" fill="none">
      <circle cx="4" cy="5" r="3.5" stroke="#B09245" strokeWidth="1"/>
      <line x1="7.5" y1="5" x2="17" y2="5" stroke="#B09245" strokeWidth="1"/>
      <line x1="14" y1="5" x2="14" y2="7" stroke="#B09245" strokeWidth="1"/>
      <line x1="16" y1="5" x2="16" y2="7" stroke="#B09245" strokeWidth="1"/>
    </svg>
  );
}

export default function SubmitScreen({ repName, totalAppointments, totalDirectLeads, totalProspects, totalSales, onStartNew }) {
  return (
    <div className="submit-success" style={{ display: 'block' }}>
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ margin: '0 auto 1rem' }}>
        <circle cx="24" cy="24" r="23" stroke="#B09245" strokeWidth="1.5" />
        <path d="M14 24l7 7 13-14" stroke="#B09245" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--gold)' }}>
        Copper Builders
      </div>
      <div className="success-rule" />
      <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 20, fontWeight: 400, color: 'var(--slate-dark)' }}>
        Log submitted
      </div>
      <div style={{ fontSize: 13, color: 'var(--slate)', marginTop: 6 }}>
        Week ending {getWeekEndingShort()}
        {repName && <> &mdash; {repName}</>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontFamily: "'Libre Baskerville', serif", color: 'var(--slate-dark)' }}>{totalSales || 0}</div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--slate)' }}>Sales</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontFamily: "'Libre Baskerville', serif", color: 'var(--slate-dark)' }}>{totalProspects}</div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--slate)' }}>Prospects</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontFamily: "'Libre Baskerville', serif", color: 'var(--slate-dark)' }}>{totalAppointments}</div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--slate)' }}>Appointments</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontFamily: "'Libre Baskerville', serif", color: 'var(--slate-dark)' }}>{totalDirectLeads || 0}</div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--slate)' }}>Leads</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 }}>
        <div style={{ flex: 0, width: 40, height: 1, background: 'var(--gold)' }} />
        <KeySvg />
        <div style={{ flex: 0, width: 40, height: 1, background: 'var(--gold)' }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 16, fontStyle: 'italic' }}>
        Your report has been recorded. Have a great week!
      </div>

      {onStartNew && (
        <button
          onClick={onStartNew}
          style={{
            marginTop: 24, height: 36, padding: '0 20px', background: 'transparent',
            color: 'var(--gold)', border: '1px solid var(--gold)', borderRadius: 4,
            fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Start New Report
        </button>
      )}
    </div>
  );
}
