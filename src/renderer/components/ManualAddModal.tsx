import { useState } from 'react';
import { useApp } from '../store/appState';

export default function ManualAddModal({ onClose }: { onClose: () => void }) {
  const { addManualJob } = useApp();
  const [username, setUsername] = useState('');
  const [item, setItem] = useState('');
  const [price, setPrice] = useState('');
  const [type, setType] = useState<'SOLD' | 'GIVEAWAY'>('SOLD');
  const [printing, setPrinting] = useState(false);

  const handlePrint = async () => {
    if (!username.trim() || !item.trim()) return;
    setPrinting(true);
    await addManualJob({
      username: username.trim().replace('@', ''),
      item_description: item.trim(),
      price: parseFloat(price) || 0,
      sale_type: type,
      event_id: 'manual-' + Date.now(),
    });
    setPrinting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>

      <div className="rounded-xl p-6 w-96"
        style={{ background: 'var(--se-surface)', border: '1px solid var(--se-border)' }}>

        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg" style={{ color: 'var(--se-text)' }}>Add Manual Order</h2>
          <button onClick={onClose} style={{ color: 'var(--se-muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div className="flex flex-col gap-4">
          {/* Type toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--se-border)' }}>
            {(['SOLD', 'GIVEAWAY'] as const).map(t => (
              <button key={t} onClick={() => setType(t)}
                className="flex-1 py-2 font-bold text-sm transition-all"
                style={{
                  background: type === t ? (t === 'SOLD' ? 'var(--se-sold)' : 'var(--se-giveaway)') : 'transparent',
                  color: type === t ? 'white' : 'var(--se-muted)',
                }}>
                {t === 'SOLD' ? '🏷 SOLD' : '🎁 GIVEAWAY'}
              </button>
            ))}
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--se-muted)', fontWeight: 600, marginBottom: 6, display: 'block' }}>
              WHATNOT USERNAME
            </label>
            <input className="input-field" value={username} onChange={e => setUsername(e.target.value)}
              placeholder="@username" autoFocus />
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--se-muted)', fontWeight: 600, marginBottom: 6, display: 'block' }}>
              ITEM DESCRIPTION
            </label>
            <input className="input-field" value={item} onChange={e => setItem(e.target.value)}
              placeholder="e.g. PSA 9 Charizard Holo" />
          </div>

          {type === 'SOLD' && (
            <div>
              <label style={{ fontSize: 12, color: 'var(--se-muted)', fontWeight: 600, marginBottom: 6, display: 'block' }}>
                SALE PRICE
              </label>
              <input className="input-field" value={price} onChange={e => setPrice(e.target.value)}
                placeholder="0.00" type="number" min="0" step="0.01" />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
            <button className="btn-primary flex-1" onClick={handlePrint} disabled={printing || !username || !item}>
              {printing ? '⏳ Printing...' : '🖨 Print Label'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
