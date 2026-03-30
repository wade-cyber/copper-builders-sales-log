import { getWeekEnding } from '../utils/dates';

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

export default function Header() {
  return (
    <div className="header">
      <div className="header-top">
        <div>
          <div className="brand-name">Copper Builders</div>
          <div className="brand-sub">Built on Trust</div>
        </div>
        <div>
          <div className="rt-label">Reporting Through</div>
          <div className="rt-date">{getWeekEnding()}</div>
        </div>
      </div>
      <div className="key-divider">
        <div className="key-line" />
        <KeySvg />
        <div className="key-line" />
      </div>
      <div className="page-title-row">
        <div className="page-title">Weekly Sales Log</div>
        <a href="/how-it-works.html" className="help-btn">Help</a>
      </div>
      <div className="due-note">Reports due Monday by 10:00 AM</div>
    </div>
  );
}
