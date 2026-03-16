import { useState, useEffect } from 'react';

const api = (window as any).sellersEdge;

interface Props { onComplete: () => void; }

const STEPS = ['Welcome', 'Printer', 'Logo', 'Account', 'Test Print'];

export default function SetupWizard({ onComplete }: Props) {
  const [step,     setStep]     = useState(0);
  const [printers, setPrinters] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({
    printer_name:    '',
    label_width_mm:  '101.6',
    label_height_mm: '152.4',
    logo_path:       '',
    logo_position:   'top-left',
    sold_color:      '#22c55e',
    giveaway_color:  '#f59e0b',
    font_scale:      'medium',
    sound_enabled:   'true',
    sound_volume:    '0.7',
    dark_mode:       'true',
    setup_complete:  'false',
  });
  const [account,     setAccount]     = useState({ name: '', account_number: '', email: '', password: '', notes: '' });
  const [testResult,  setTestResult]  = useState<'idle' | 'printing' | 'ok' | 'error'>('idle');
  const [testError,   setTestError]   = useState('');
  const [skipAccount, setSkipAccount] = useState(false);

  useEffect(() => {
    api?.getPrinters().then((p: any[]) => setPrinters(p || []));
  }, []);

  const set = (k: string, v: string) => setSettings((s: any) => ({ ...s, [k]: v }));

  const selectLogo = async () => {
    const p = await api?.selectLogo();
    if (p) set('logo_path', p);
  };

  const handleTestPrint = async () => {
    setTestResult('printing');
    setTestError('');
    await api?.saveSettings(settings);
    const result = await api?.testPrint();
    if (result?.ok) setTestResult('ok');
    else { setTestResult('error'); setTestError(result?.error || 'Unknown error'); }
  };

  const handleFinish = async () => {
    await api?.saveSettings({ ...settings, setup_complete: 'true' });
    if (!skipAccount && account.name) {
      await api?.saveAccount(account);
    }
    onComplete();
  };

  const canAdvance = () => {
    if (step === 1) return !!settings.printer_name;
    if (step === 3) return skipAccount || !!account.name;
    return true;
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'var(--se-bg)' }}>

      <div className="flex flex-col rounded-2xl overflow-hidden"
        style={{
          width: 520, background: 'var(--se-surface)',
          border: '1px solid var(--se-border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}>

        {/* Progress bar */}
        <div style={{ height: 3, background: 'var(--se-border)' }}>
          <div style={{
            height: '100%', background: 'var(--se-blue)',
            width: `${((step + 1) / STEPS.length) * 100}%`,
            transition: 'width 0.3s ease',
          }} />
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--se-border)' }}>
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex items-center justify-center rounded-full text-xs font-bold"
                style={{
                  width: 24, height: 24,
                  background: i < step ? 'var(--se-sold)' : i === step ? 'var(--se-blue)' : 'var(--se-border)',
                  color: i <= step ? 'white' : 'var(--se-muted)',
                  fontSize: 11,
                }}>
                {i < step ? '✓' : i + 1}
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: i === step ? 'var(--se-text)' : 'var(--se-muted)',
              }}>
                {label}
              </span>
              {i < STEPS.length - 1 && (
                <div style={{ width: 20, height: 1, background: 'var(--se-border)', margin: '0 4px' }} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="p-8 flex flex-col gap-5" style={{ minHeight: 320 }}>

          {/* ── Step 0: Welcome ── */}
          {step === 0 && (
            <div className="flex flex-col items-center text-center gap-5">
              <img src="/assets/logo.jpeg" alt="Sellers Edge" className="rounded-xl"
                style={{ height: 72, width: 'auto' }} />
              <div>
                <div className="brand-font text-3xl mb-2">
                  WELCOME TO <span style={{ color: 'var(--se-blue)' }}>SELLERS EDGE</span>
                </div>
                <div style={{ fontSize: 14, color: 'var(--se-muted)', lineHeight: 1.7 }}>
                  Let's get you set up in about 2 minutes. You'll choose your printer,
                  upload your logo, and print a test label to make sure everything works.
                </div>
              </div>
              <div className="flex flex-col gap-2 w-full text-left"
                style={{ background: 'var(--se-surface2)', borderRadius: 10, padding: '14px 18px' }}>
                {[
                  '🖨 Works with Rollo, Zebra, Brother, and any installed printer',
                  '🌐 Detects sales via the Sellers Edge browser extension',
                  '🔒 All data stays on your computer — nothing uploaded',
                ].map((t, i) => (
                  <div key={i} style={{ fontSize: 13, color: 'var(--se-text)' }}>{t}</div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 1: Printer ── */}
          {step === 1 && (
            <>
              <div className="brand-font text-xl" style={{ color: 'var(--se-text)' }}>
                Choose Your Printer
              </div>
              <WizardField label="Select Printer">
                <select className="input-field" value={settings.printer_name}
                  onChange={e => set('printer_name', e.target.value)}>
                  <option value="">— Select a printer —</option>
                  {printers.map((p: any) => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </WizardField>
              <div className="grid grid-cols-2 gap-4">
                <WizardField label="Label Width (mm)">
                  <input className="input-field" type="number"
                    value={settings.label_width_mm}
                    onChange={e => set('label_width_mm', e.target.value)} />
                </WizardField>
                <WizardField label="Label Height (mm)">
                  <input className="input-field" type="number"
                    value={settings.label_height_mm}
                    onChange={e => set('label_height_mm', e.target.value)} />
                </WizardField>
              </div>
              <div style={{ fontSize: 12, color: 'var(--se-muted)', padding: '8px 12px', background: 'var(--se-surface2)', borderRadius: 8 }}>
                💡 Rollo default: <strong style={{ color: 'var(--se-text)' }}>101.6 × 152.4 mm</strong> (4×6 inch)
              </div>
            </>
          )}

          {/* ── Step 2: Logo ── */}
          {step === 2 && (
            <>
              <div className="brand-font text-xl" style={{ color: 'var(--se-text)' }}>
                Upload Your Store Logo
              </div>
              <div className="flex gap-4 items-start">
                <div className="flex-1">
                  <WizardField label="Logo File (PNG, SVG, or JPG)">
                    <div className="flex gap-3">
                      <input className="input-field flex-1" readOnly
                        value={settings.logo_path || ''} placeholder="No logo selected" />
                      <button className="btn-ghost flex-shrink-0" onClick={selectLogo}>Browse…</button>
                    </div>
                    {settings.logo_path && (
                      <div style={{ fontSize: 11, color: 'var(--se-sold)', marginTop: 4 }}>✓ Logo selected</div>
                    )}
                  </WizardField>
                  <div style={{ marginTop: 16 }}>
                    <WizardField label="Logo Position on Label">
                      <div className="flex gap-2">
                        {(['top-left', 'top-center', 'top-right'] as const).map(pos => (
                          <button key={pos} onClick={() => set('logo_position', pos)}
                            className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                            style={{
                              background: settings.logo_position === pos ? 'var(--se-blue)' : 'var(--se-surface2)',
                              color: settings.logo_position === pos ? 'white' : 'var(--se-muted)',
                              border: '1px solid var(--se-border)',
                            }}>
                            {pos === 'top-left' ? '◀ Left' : pos === 'top-center' ? '▬ Center' : 'Right ▶'}
                          </button>
                        ))}
                      </div>
                    </WizardField>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--se-muted)' }}>
                No logo yet? That's fine — you can add one later in Settings. Your store name will appear instead.
              </div>
            </>
          )}

          {/* ── Step 3: Account ── */}
          {step === 3 && (
            <>
              <div className="brand-font text-xl" style={{ color: 'var(--se-text)' }}>
                Add Your Whatnot Account
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={skipAccount} onChange={e => setSkipAccount(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--se-blue)' }} />
                <span style={{ fontSize: 13, color: 'var(--se-muted)' }}>Skip for now — I'll add it later in Accounts</span>
              </label>
              {!skipAccount && (
                <div className="flex flex-col gap-4">
                  {[
                    { key: 'name',           label: 'STORE NAME',       placeholder: 'My Card Shop',       type: 'text'     },
                    { key: 'account_number', label: 'WHATNOT SELLER ID',placeholder: 'Optional',           type: 'text'     },
                    { key: 'email',          label: 'LOGIN EMAIL',      placeholder: 'you@example.com',    type: 'email'    },
                    { key: 'password',       label: 'PASSWORD',         placeholder: '••••••••',           type: 'password' },
                  ].map(f => (
                    <WizardField key={f.key} label={f.label}>
                      <input className="input-field" type={f.type}
                        value={(account as any)[f.key] || ''}
                        placeholder={f.placeholder}
                        onChange={e => setAccount(a => ({ ...a, [f.key]: e.target.value }))} />
                    </WizardField>
                  ))}
                  <div style={{ fontSize: 11, color: 'var(--se-muted)', lineHeight: 1.6 }}>
                    🔒 Credentials are encrypted with AES-256 and stored only on this device.
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Step 4: Test Print ── */}
          {step === 4 && (
            <div className="flex flex-col items-center text-center gap-5">
              <div style={{ fontSize: 48 }}>🖨</div>
              <div>
                <div className="brand-font text-xl mb-2">Print a Test Label</div>
                <div style={{ fontSize: 13, color: 'var(--se-muted)', lineHeight: 1.7 }}>
                  Make sure your <strong style={{ color: 'var(--se-text)' }}>{settings.printer_name || 'printer'}</strong> is
                  on and loaded with labels, then hit the button below.
                </div>
              </div>

              {testResult === 'idle' && (
                <button className="btn-primary" style={{ fontSize: 14, padding: '12px 32px' }} onClick={handleTestPrint}>
                  🖨 Print Test Label
                </button>
              )}
              {testResult === 'printing' && (
                <div style={{ color: 'var(--se-muted)', fontSize: 14 }} className="pulse-dot">
                  Sending to printer…
                </div>
              )}
              {testResult === 'ok' && (
                <div className="flex flex-col items-center gap-3">
                  <div style={{ fontSize: 40 }}>✅</div>
                  <div style={{ fontSize: 14, color: 'var(--se-sold)', fontWeight: 700 }}>Test label printed!</div>
                  <div style={{ fontSize: 12, color: 'var(--se-muted)' }}>You're all set. Click Finish to start using Sellers Edge.</div>
                </div>
              )}
              {testResult === 'error' && (
                <div className="flex flex-col items-center gap-3">
                  <div style={{ fontSize: 40 }}>❌</div>
                  <div style={{ fontSize: 13, color: 'var(--se-error)', fontWeight: 700 }}>Print failed</div>
                  <div style={{ fontSize: 11, color: 'var(--se-muted)', maxWidth: 300 }}>{testError || 'Check that the printer is on and set as default.'}</div>
                  <button className="btn-ghost" onClick={handleTestPrint}>Try Again</button>
                  <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setTestResult('ok')}>
                    Skip — I'll troubleshoot later
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-8 py-5"
          style={{ borderTop: '1px solid var(--se-border)' }}>
          <button className="btn-ghost" onClick={() => setStep(s => s - 1)}
            style={{ visibility: step === 0 ? 'hidden' : 'visible' }}>
            ← Back
          </button>

          {step < STEPS.length - 1 ? (
            <button className="btn-primary" onClick={() => setStep(s => s + 1)}
              disabled={!canAdvance()}
              style={{ minWidth: 120 }}>
              Next →
            </button>
          ) : (
            <button className="btn-primary" onClick={handleFinish}
              disabled={testResult === 'printing'}
              style={{ minWidth: 120 }}>
              ✅ Finish Setup
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function WizardField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: 'var(--se-muted)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 7, display: 'block' }}>
        {label}
      </label>
      {children}
    </div>
  );
}
