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
    <div className="card" style={{ background: 'var(--cream)', border: '1px dashed var(--border)' }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--slate)' }}>
        New Prospect
      </div>
      <input
        type="text"
        placeholder="Full name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ marginBottom: 8 }}
      />
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <select value={ranking} onChange={(e) => setRanking(e.target.value)} style={{ width: 70, flex: 'none' }}>
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
        </select>
        <select value={nextStep} onChange={(e) => setNextStep(e.target.value)}>
          <option value="">Next step…</option>
          {NEXT_STEPS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <button className="btn-primary btn-small" onClick={handleSave} disabled={!name.trim()}>
        Save Prospect
      </button>
    </div>
  );
}
