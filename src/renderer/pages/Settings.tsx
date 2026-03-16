import { useState, useEffect } from 'react';

const api = (window as any).sellersEdge;

export default function Settings() {
  const [tab, setTab] = useState('printer');
  const [settings, setSettings] = useState<any>({});
  const [printers, setPrinters] = useState<any[]>([]);
  const [saved, setSaved] = useState(false);
  const [pinLocked, setPinLocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [newPin, setNewPin] = useState('');

  useEffect(() => {
    api?.getSettings().then((s: any) => {
      setSettings(s || {});
      if (s?.pin_hash) setPinLocked(true);
    });
    api?.getPrinters().then((p: any[]) => setPrinters(p || []));
  }, []);

  const save = async () => {
    await api?.saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const set = (k: string, v: string) => setSettings((s: any) => ({ ...s, [k]: v }));

  if (pinLocked) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center" style={{ maxWidth: 300 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <div className="font-bold text-xl mb-2">Settings Locked</div>
          <div style={{ fontSize: 13, color: 'var(--se-muted)', marginBottom: 20 }}>
            Enter your PIN to access settings
          </div>
          <input
            className="input-field mb-3" type="password" value={pinInput}
            onChange={e => setPinInput(e.target.value)} autoFocus maxLength={8}
            placeholder="Enter PIN"
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
          />
          {pinError && <div style={{ color: 'var(--se-error)', fontSize: 12, marginBottom: 8 }}>{pinError}</div>}
          <button className="btn-primary w-full" onClick={handleUnlock}>Unlock</button>
        </div>
      </div>
    );
  }

  async function handleUnlock() {
    const ok = await api?.verifyPin(pinInput);
    if (ok) { setPinLocked(false); setPinError(''); }
    else setPinError('Incorrect PIN');
  }

  const tabs = [
    { id: 'printer', label: '🖨 Printer' },
    { id: 'label',   label: '🏷 Label'   },
    { id: 'sound',   label: '🔔 Sound'   },
    { id: 'app',     label: '⚙ App'     },
  ];

  return (
    <div className="flex h-full">

      {/* Sidebar */}
      <div className="flex flex-col py-4 px-2"
        style={{ width: 150, background: 'var(--se-surface)', borderRight: '1px solid var(--se-border)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="text-left px-3 py-2 rounded-lg mb-1 text-sm font-semibold transition-all"
            style={{
              background: tab === t.id ? 'var(--se-surface2)' : 'transparent',
              color:      tab === t.id ? 'var(--se-text)'    : 'var(--se-muted)',
              borderLeft: tab === t.id ? '3px solid var(--se-blue)' : '3px solid transparent',
            }}>
            {t.label}
          </button>
        ))}
        <div className="mt-auto px-2">
          <button className="btn-primary w-full" onClick={save}>
            {saved ? '✅ Saved!' : 'Save'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'printer' && <PrinterTab settings={settings} set={set} printers={printers} />}
        {tab === 'label'   && <LabelTab   settings={settings} set={set} />}
        {tab === 'sound'   && <SoundTab   settings={settings} set={set} />}
        {tab === 'app'     && <AppTab     settings={settings} set={set} newPin={newPin} setNewPin={setNewPin} />}
      </div>
    </div>
  );
}

// ── Printer Tab ───────────────────────────────────────────────────────────────
function PrinterTab({ settings, set, printers }: any) {
  return (
    <Section title="Printer Configuration">
      <Field label="Active Printer">
        <select className="input-field" value={settings.printer_name || ''}
          onChange={e => set('printer_name', e.target.value)}>
          <option value="">System Default</option>
          {printers.map((p: any) => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Label Width (mm)">
          <input className="input-field" type="number"
            value={settings.label_width_mm || '101.6'}
            onChange={e => set('label_width_mm', e.target.value)}
            placeholder="101.6" />
        </Field>
        <Field label="Label Height (mm)">
          <input className="input-field" type="number"
            value={settings.label_height_mm || '152.4'}
            onChange={e => set('label_height_mm', e.target.value)}
            placeholder="152.4" />
        </Field>
      </div>

      <InfoBox>
        💡 Rollo default: <strong style={{ color: 'var(--se-text)' }}>101.6 × 152.4 mm</strong> (4 × 6 inch).
        Other common sizes: 50×25 mm, 62×100 mm, 100×100 mm.
      </InfoBox>

      <Field label="Test Print">
        <TestPrintButton />
      </Field>
    </Section>
  );
}

// ── Label Design Tab ──────────────────────────────────────────────────────────
function LabelTab({ settings, set }: any) {
  const selectLogo = async () => {
    const path = await (window as any).sellersEdge?.selectLogo();
    if (path) set('logo_path', path);
  };

  return (
    <Section title="Label Design">
      <Field label="Store Logo (PNG, SVG, or JPG)">
        <div className="flex gap-3 items-center">
          <input className="input-field flex-1" readOnly
            value={settings.logo_path || ''} placeholder="No logo selected" />
          <button className="btn-ghost flex-shrink-0" onClick={selectLogo}>Browse…</button>
        </div>
        {settings.logo_path && (
          <div style={{ fontSize: 11, color: 'var(--se-sold)', marginTop: 5 }}>✓ Logo loaded</div>
        )}
      </Field>

      <Field label="Logo Position">
        <div className="flex gap-2">
          {(['top-left', 'top-center', 'top-right'] as const).map(pos => (
            <button key={pos} onClick={() => set('logo_position', pos)}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: (settings.logo_position || 'top-left') === pos
                  ? 'var(--se-blue)' : 'var(--se-surface2)',
                color: (settings.logo_position || 'top-left') === pos
                  ? 'white' : 'var(--se-muted)',
                border: '1px solid var(--se-border)',
              }}>
              {pos === 'top-left' ? '◀ Left' : pos === 'top-center' ? '▬ Center' : 'Right ▶'}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="SOLD Badge Color">
          <ColorInput value={settings.sold_color || '#22c55e'} onChange={v => set('sold_color', v)} />
        </Field>
        <Field label="GIVEAWAY Badge Color">
          <ColorInput value={settings.giveaway_color || '#f59e0b'} onChange={v => set('giveaway_color', v)} />
        </Field>
      </div>

      <Field label="Font Scale">
        <div className="flex gap-2">
          {(['small', 'medium', 'large'] as const).map(s => (
            <button key={s} onClick={() => set('font_scale', s)}
              className="flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all"
              style={{
                background: (settings.font_scale || 'medium') === s
                  ? 'var(--se-blue)' : 'var(--se-surface2)',
                color: (settings.font_scale || 'medium') === s
                  ? 'white' : 'var(--se-muted)',
                border: '1px solid var(--se-border)',
              }}>
              {s}
            </button>
          ))}
        </div>
      </Field>

      {/* Live label preview */}
      <Field label="Label Preview">
        <LabelPreview settings={settings} set={set} />
      </Field>
    </Section>
  );
}

// Common label size presets
const SIZE_PRESETS = [
  { label: '4×6"',    w: 101.6, h: 152.4, note: 'Rollo default' },
  { label: '4×4"',    w: 101.6, h: 101.6 },
  { label: '2×4"',    w:  50.8, h: 101.6 },
  { label: '2×1"',    w:  50.8, h:  25.4 },
  { label: '62×100',  w:  62,   h: 100   },
  { label: '100×100', w: 100,   h: 100   },
];

function LabelPreview({ settings, set }: { settings: any; set: (k: string, v: string) => void }) {
  const [previewType, setPreviewType] = useState<'SOLD' | 'GIVEAWAY'>('SOLD');
  const [username,    setUsername]    = useState('coolbuyer99');
  const [itemDesc,    setItemDesc]    = useState('PSA 9 Charizard Holo Base Set');
  const [price,       setPrice]       = useState('45.00');
  const [zoom,        setZoom]        = useState(1);

  const soldColor     = settings.sold_color     || '#22c55e';
  const giveawayColor = settings.giveaway_color || '#f59e0b';
  const badgeColor    = previewType === 'SOLD' ? soldColor : giveawayColor;
  const fScale        = settings.font_scale === 'small' ? 0.82
                      : settings.font_scale === 'large'  ? 1.18 : 1;
  const logoPos       = settings.logo_position || 'top-left';

  // Read live dimensions — updates instantly as user changes values in Printer tab
  const mmW = Math.max(10, parseFloat(settings.label_width_mm)  || 101.6);
  const mmH = Math.max(10, parseFloat(settings.label_height_mm) || 152.4);

  // Fit within a bounded canvas while preserving true aspect ratio
  const MAX_W = 300, MAX_H = 380;
  const rawW  = MAX_W * zoom;
  const rawH  = rawW * (mmH / mmW);
  const W     = rawH > MAX_H * zoom ? (MAX_H * zoom * (mmW / mmH)) : rawW;
  const H     = W * (mmH / mmW);

  // Human-readable size label
  const inW = (mmW / 25.4).toFixed(1);
  const inH = (mmH / 25.4).toFixed(1);

  const logoBlock = (
    <div style={{
      fontWeight: 900, fontSize: 9 * fScale,
      color: '#0a3d8f', fontFamily: 'Barlow Condensed, sans-serif',
      letterSpacing: '-0.01em',
    }}>
      {settings.logo_path ? '[ YOUR LOGO ]' : 'SELLERS EDGE'}
    </div>
  );

  const line2 = itemDesc.length > 36 ? itemDesc.slice(36, 72) : '';
  const line1 = itemDesc.slice(0, 36);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Size presets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--se-muted)', fontWeight: 700, letterSpacing: '0.08em' }}>
          QUICK SIZE PRESETS
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SIZE_PRESETS.map(p => {
            const active = Math.abs(mmW - p.w) < 0.5 && Math.abs(mmH - p.h) < 0.5;
            return (
              <button key={p.label}
                onClick={() => { set('label_width_mm', String(p.w)); set('label_height_mm', String(p.h)); }}
                style={{
                  padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  borderRadius: 5, border: `1px solid ${active ? 'var(--se-blue)' : 'var(--se-border)'}`,
                  background: active ? 'var(--se-blue)' : 'var(--se-surface2)',
                  color: active ? 'white' : 'var(--se-muted)',
                  transition: 'all .15s',
                }}>
                {p.label}
                {p.note && <span style={{ fontSize: 9, opacity: 0.75, marginLeft: 3 }}>({p.note})</span>}
              </button>
            );
          })}
        </div>

        {/* Live size indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: 'var(--se-text)',
            background: 'var(--se-surface2)', border: '1px solid var(--se-border)',
            borderRadius: 6, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ color: 'var(--se-muted)', fontSize: 11 }}>Current size:</span>
            <span style={{ color: 'var(--se-blue)' }}>{mmW} × {mmH} mm</span>
            <span style={{ color: 'var(--se-muted)', fontSize: 11 }}>({inW}" × {inH}")</span>
          </div>
        </div>
      </div>

      {/* Controls row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Type toggle */}
        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--se-border)', flexShrink: 0 }}>
          {(['SOLD', 'GIVEAWAY'] as const).map(t => (
            <button key={t} onClick={() => setPreviewType(t)}
              style={{
                padding: '5px 12px', fontSize: 11, fontWeight: 800, cursor: 'pointer', border: 'none',
                background: previewType === t ? (t === 'SOLD' ? soldColor : giveawayColor) : 'var(--se-surface2)',
                color: previewType === t ? 'white' : 'var(--se-muted)',
                transition: 'all .15s',
              }}>
              {t}
            </button>
          ))}
        </div>

        {/* Zoom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--se-muted)', fontWeight: 600 }}>Zoom</span>
          <input type="range" min="0.6" max="1.6" step="0.1" value={zoom}
            onChange={e => setZoom(parseFloat(e.target.value))}
            style={{ width: 80, accentColor: 'var(--se-blue)' }} />
          <span style={{ fontSize: 11, color: 'var(--se-muted)', width: 32, fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(zoom * 100)}%
          </span>
        </div>
      </div>

      {/* Editable fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: 10, color: 'var(--se-muted)', fontWeight: 700, letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>
            PREVIEW USERNAME
          </label>
          <input className="input-field" value={username}
            onChange={e => setUsername(e.target.value.replace('@', ''))}
            placeholder="coolbuyer99" style={{ fontSize: 12 }} />
        </div>
        <div>
          <label style={{ fontSize: 10, color: 'var(--se-muted)', fontWeight: 700, letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>
            PREVIEW PRICE
          </label>
          <input className="input-field" value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="45.00" style={{ fontSize: 12 }}
            disabled={previewType === 'GIVEAWAY'} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ fontSize: 10, color: 'var(--se-muted)', fontWeight: 700, letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>
            PREVIEW ITEM DESCRIPTION
          </label>
          <input className="input-field" value={itemDesc}
            onChange={e => setItemDesc(e.target.value)}
            placeholder="Item description" style={{ fontSize: 12 }} />
        </div>
      </div>

      {/* Label render */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
        <div style={{
          width: W, height: H,
          background: 'white',
          borderRadius: 6,
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          border: '1px solid #e5e7eb',
        }}>
          {/* Top stripe */}
          <div style={{ height: 5 * zoom, background: '#0a64df', flexShrink: 0 }} />

          {/* Body */}
          <div style={{ flex: 1, padding: `${10 * zoom}px ${10 * zoom}px`, display: 'flex', flexDirection: 'column', gap: 0 }}>

            {/* Logo + badge row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 * zoom }}>
              {logoPos === 'top-left' && logoBlock}
              {logoPos === 'top-center' && <div style={{ flex: 1, textAlign: 'center' }}>{logoBlock}</div>}
              {logoPos === 'top-right' && <div style={{ flex: 1 }} />}

              <div style={{
                background: badgeColor, color: 'white',
                fontSize: 9 * fScale * zoom, fontWeight: 800,
                padding: `${2 * zoom}px ${7 * zoom}px`,
                borderRadius: 3, letterSpacing: '0.04em', flexShrink: 0,
                marginLeft: logoPos === 'top-right' ? 0 : 6,
              }}>
                {previewType}
              </div>

              {logoPos === 'top-right' && <div style={{ marginLeft: 6 }}>{logoBlock}</div>}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: '#e5e7eb', marginBottom: 8 * zoom, flexShrink: 0 }} />

            {/* Username */}
            <div style={{
              fontSize: 13 * fScale * zoom, fontWeight: 700, color: '#0a64df',
              marginBottom: 6 * zoom, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
            }}>
              @{username || 'username'}
            </div>

            {/* Item description */}
            <div style={{
              fontSize: 11 * fScale * zoom, fontWeight: 600, color: '#111',
              lineHeight: 1.35, marginBottom: 4 * zoom,
            }}>
              {line1}
            </div>
            {line2 && (
              <div style={{ fontSize: 11 * fScale * zoom, fontWeight: 600, color: '#111', lineHeight: 1.35 }}>
                {line2}
              </div>
            )}

            {/* Price — pushed to bottom */}
            <div style={{ marginTop: 'auto', paddingTop: 6 * zoom }}>
              <div style={{
                fontSize: 16 * fScale * zoom, fontWeight: 900, color: '#111',
                fontFamily: 'Barlow Condensed, sans-serif',
              }}>
                {previewType === 'GIVEAWAY' ? 'FREE GIVEAWAY' : `$${price || '0.00'}`}
              </div>
            </div>
          </div>

          {/* Bottom stripe */}
          <div style={{ height: 4 * zoom, background: '#0a64df', flexShrink: 0 }} />
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--se-muted)', textAlign: 'center' }}>
        Preview shows actual label proportions at {mmW}×{mmH}mm — save to apply changes
      </div>
    </div>
  );
}

// ── Sound Tab ─────────────────────────────────────────────────────────────────
function SoundTab({ settings, set }: any) {
  const testSound = () => {
    const audio = new Audio();
    audio.volume = parseFloat(settings.sound_volume || '0.7');
    // Generate a quick beep via Web Audio API
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(parseFloat(settings.sound_volume || '0.7'), ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  };

  return (
    <Section title="Sound Alerts">
      <Field label="Enable Sound on Print">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={settings.sound_enabled !== 'false'}
            onChange={e => set('sound_enabled', e.target.checked ? 'true' : 'false')}
            style={{ width: 18, height: 18, accentColor: 'var(--se-blue)', cursor: 'pointer' }} />
          <span style={{ fontSize: 14, color: 'var(--se-text)' }}>
            Play a sound each time a label prints
          </span>
        </label>
      </Field>

      <Field label="Volume">
        <div className="flex items-center gap-4">
          <input type="range" min="0" max="1" step="0.05"
            value={settings.sound_volume || '0.7'}
            onChange={e => set('sound_volume', e.target.value)}
            style={{ flex: 1, accentColor: 'var(--se-blue)' }} />
          <span style={{ fontSize: 13, color: 'var(--se-text)', width: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(parseFloat(settings.sound_volume || '0.7') * 100)}%
          </span>
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={testSound}>
            Test
          </button>
        </div>
      </Field>
    </Section>
  );
}

// ── App Tab ───────────────────────────────────────────────────────────────────
function AppTab({ settings, set, newPin, setNewPin }: any) {
  const handleSetPin = async () => {
    if (newPin.length < 4) return;
    await api?.setPin(newPin);
    setNewPin('');
    alert('PIN updated successfully.');
  };

  return (
    <Section title="App Settings">
      <Field label="Dark Mode">
        <Toggle
          checked={settings.dark_mode !== 'false'}
          onChange={v => set('dark_mode', v ? 'true' : 'false')}
          label="Dark mode (recommended for streaming)" />
      </Field>

      <Field label="Extension WebSocket Port">
        <div className="flex items-center gap-3">
          <input className="input-field" value={settings.websocket_port || '47891'}
            onChange={e => set('websocket_port', e.target.value)}
            placeholder="47891" style={{ maxWidth: 100 }} />
          <span style={{ fontSize: 12, color: 'var(--se-muted)' }}>
            Default 47891 — only change if this port conflicts with another app
          </span>
        </div>
      </Field>

      <Field label="Settings PIN">
        <div className="flex gap-3">
          <input className="input-field flex-1" type="password" value={newPin}
            onChange={e => setNewPin(e.target.value)}
            placeholder="New PIN (4–8 digits)" maxLength={8} />
          <button className="btn-ghost flex-shrink-0" onClick={handleSetPin} disabled={newPin.length < 4}>
            Set PIN
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--se-muted)', marginTop: 4 }}>
          Lock the Settings screen with a PIN to prevent accidental changes mid-stream.
        </div>
      </Field>

      <InfoBox>
        <strong style={{ color: 'var(--se-text)' }}>Sellers Edge v1.2</strong> &nbsp;·&nbsp;
        Auto-updates enabled &nbsp;·&nbsp; All data stored locally on your device
      </InfoBox>
    </Section>
  );
}

// ── Shared UI Atoms ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-bold text-lg mb-6"
        style={{ color: 'var(--se-text)', borderBottom: '1px solid var(--se-border)', paddingBottom: 12 }}>
        {title}
      </h2>
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        fontSize: 11, color: 'var(--se-muted)', fontWeight: 700,
        letterSpacing: '0.08em', marginBottom: 8, display: 'block',
      }}>
        {label.toUpperCase()}
      </label>
      {children}
    </div>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-3 items-center">
      <input type="color" value={value} onChange={e => onChange(e.target.value)}
        style={{
          width: 44, height: 36, border: '1px solid var(--se-border)',
          borderRadius: 6, cursor: 'pointer', background: 'none', padding: 2,
        }} />
      <input className="input-field flex-1" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function Toggle({ checked, onChange, label }: {
  checked: boolean; onChange: (v: boolean) => void; label: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ width: 18, height: 18, accentColor: 'var(--se-blue)', cursor: 'pointer' }} />
      <span style={{ fontSize: 14, color: 'var(--se-text)' }}>{label}</span>
    </label>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 12, color: 'var(--se-muted)', padding: '10px 14px',
      background: 'var(--se-surface2)', borderRadius: 8, lineHeight: 1.7,
    }}>
      {children}
    </div>
  );
}

// ── Test Print Button ─────────────────────────────────────────────────────────
function TestPrintButton() {
  const [state, setState] = useState<'idle'|'printing'|'ok'|'error'>('idle');
  const [errMsg, setErrMsg] = useState('');

  const handleTest = async () => {
    setState('printing');
    setErrMsg('');
    await api?.saveSettings(await api.getSettings()); // flush current settings first
    const result = await api?.testPrint();
    if (result?.ok) { setState('ok'); setTimeout(() => setState('idle'), 3000); }
    else { setState('error'); setErrMsg(result?.error || 'Unknown error'); }
  };

  return (
    <div className="flex items-center gap-4">
      <button className="btn-ghost" onClick={handleTest}
        disabled={state === 'printing'}
        style={state === 'ok' ? { borderColor: 'var(--se-sold)', color: 'var(--se-sold)' }
             : state === 'error' ? { borderColor: 'var(--se-error)', color: 'var(--se-error)' } : {}}>
        {state === 'idle'     && '🖨 Test Print'}
        {state === 'printing' && '⏳ Printing...'}
        {state === 'ok'       && '✅ Printed!'}
        {state === 'error'    && '❌ Failed'}
      </button>
      {state === 'error' && errMsg && (
        <span style={{ fontSize: 12, color: 'var(--se-error)' }}>{errMsg}</span>
      )}
      {state === 'idle' && (
        <span style={{ fontSize: 12, color: 'var(--se-muted)' }}>
          Prints a sample label to verify printer is working
        </span>
      )}
    </div>
  );
}
