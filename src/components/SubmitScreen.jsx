import { getWeekEndingShort } from '../utils/dates';

function KeySvg() {
  return (
    <svg width="18" height="10" viewBox="0 0 18 10" fill="none" aria-hidden="true">
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
      <svg className="ss-check" width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <circle cx="24" cy="24" r="23" stroke="#B09245" strokeWidth="1.5" />
        <path d="M14 24l7 7 13-14" stroke="#B09245" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="ss-brand">Copper Builders</div>
      <div className="success-rule" />
      <div className="ss-title">Log submitted</div>
      <div className="ss-subtitle">
        Week ending {getWeekEndingShort()}
        {repName && <> &mdash; {repName}</>}
      </div>

      <div className="ss-stats">
        <div className="ss-stat">
          <div className="ss-stat-num">{totalSales || 0}</div>
          <div className="ss-stat-label">Sales</div>
        </div>
        <div className="ss-stat">
          <div className="ss-stat-num">{totalProspects}</div>
          <div className="ss-stat-label">Prospects</div>
        </div>
        <div className="ss-stat">
          <div className="ss-stat-num">{totalAppointments}</div>
          <div className="ss-stat-label">Appointments</div>
        </div>
        <div className="ss-stat">
          <div className="ss-stat-num">{totalDirectLeads || 0}</div>
          <div className="ss-stat-label">Leads</div>
        </div>
      </div>

      <div className="ss-divider">
        <div className="ss-divider-line" />
        <KeySvg />
        <div className="ss-divider-line" />
      </div>
      <div className="ss-closing">Your report has been recorded. Have a great week!</div>

      {onStartNew && (
        <button className="ss-new-btn" onClick={onStartNew}>Start New Report</button>
      )}
    </div>
  );
}
