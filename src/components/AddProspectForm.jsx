import { useState } from 'react';

const NEXT_STEPS = [
  'Contract appt set',
  'Follow-up call',
  'Send floor plans',
  'Site visit',
  'Financing referral',
  'Waiting on decision',
  'Plans review (BOYL)',
  'Scope review (Renovations)',
];

export default function AddProspectForm({ onSave }) {
  const [name, setName] = useState('');
  const [ranking, setRanking] = useState('B');
  const [nextStep, setNextStep] = useState('');

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), ranking, nextStep });
    setName('');
    setRanking('B');
    setNextStep('');
  };

  return (
    <div className="nf">
      <div className="nf-r3">
        <div className="nf-field" style={{ gridColumn: 'span 2' }}>
          <label>Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Prospect name"
          />
        </div>
        <div className="nf-field">
          <label>Ranking</label>
          <select value={ranking} onChange={(e) => setRanking(e.target.value)}>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
        </div>
      </div>
      <div className="nf-field">
        <label>Next Step</label>
        <select value={nextStep} onChange={(e) => setNextStep(e.target.value)}>
          <option value="">Select…</option>
          {NEXT_STEPS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <button className="save-btn" onClick={handleSave} disabled={!name.trim()}>
        Save Prospect
      </button>
    </div>
  );
}
