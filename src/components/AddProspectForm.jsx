import { useState } from 'react';

export default function AddProspectForm({ onSave }) {
  const [name, setName] = useState('');
  const [ranking, setRanking] = useState('B');
  const [lotNumber, setLotNumber] = useState('');

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), ranking, lotNumber: lotNumber.trim(), nextStep: '' });
    setName('');
    setRanking('B');
    setLotNumber('');
  };

  return (
    <div className="nf">
      <div className="nf-r3">
        <div className="nf-field" style={{ gridColumn: 'span 3' }}>
          <label>Prospect Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
        </div>
        <div className="nf-field">
          <label>Ranking</label>
          <select value={ranking} onChange={(e) => setRanking(e.target.value)}>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
        </div>
        <div className="nf-field" style={{ gridColumn: 'span 2' }}>
          <label>Lot # (optional)</label>
          <input type="text" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} placeholder="Lot number" />
        </div>
      </div>
      <button className="save-btn" onClick={handleSave} disabled={!name.trim()}>
        Save Prospect
      </button>
    </div>
  );
}
