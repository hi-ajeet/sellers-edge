import { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import Settings  from './pages/Settings';
import Accounts  from './pages/Accounts';
import SetupWizard from './components/SetupWizard';
import { AppState, useApp } from './store/appState';

const api = (window as any).sellersEdge;

function Inner() {
  const [page,         setPage]         = useState<'dashboard' | 'settings' | 'accounts'>('dashboard');
  const [setupDone,    setSetupDone]    = useState<boolean | null>(null); // null = loading
  const { connected, showUpdateBanner, showName, refreshShow } = useApp();

  // FIX 11: Check if first-launch wizard has been completed
  useEffect(() => {
    api?.getSettings().then((s: any) => {
      setSetupDone(s?.setup_complete === 'true');
    });
  }, []);

  if (setupDone === null) return null; // Loading

  // FIX 11: Show wizard on first launch
  if (!setupDone) {
    return <SetupWizard onComplete={() => setSetupDone(true)} />;
  }

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--se-bg)' }}>

      {/* FIX 8: Update banner */}
      {showUpdateBanner && (
        <div className="flex items-center justify-center gap-3 py-2"
          style={{ background: '#1a4a2e', borderBottom: '1px solid #22c55e44', fontSize: 12 }}>
          <span style={{ color: '#4ade80', fontWeight: 700 }}>
            ✅ Update downloaded — will install when you next quit
          </span>
        </div>
      )}

      {/* Titlebar */}
      <div className="titlebar flex items-center justify-between px-4"
        style={{ background: 'var(--se-surface)', borderBottom: '1px solid var(--se-border)', height: 50, flexShrink: 0 }}>

        <div className="flex items-center gap-3" style={{ paddingLeft: 72 }}>
          <img src="/assets/logo.jpeg" alt="Sellers Edge" className="rounded"
            style={{ height: 28, width: 'auto' }} />
          <div>
            <div className="brand-font" style={{ fontSize: 17, lineHeight: 1.1 }}>
              SELLERS <span style={{ color: 'var(--se-blue)' }}>EDGE</span>
            </div>
            <div style={{ fontSize: 9, color: 'var(--se-muted)', letterSpacing: '0.08em', marginTop: -1 }}>
              AUTOMATIC WHATNOT LABELING
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1 rounded-full"
            style={{
              marginLeft: 10,
              background: 'var(--se-surface2)',
              border: `1px solid ${connected ? '#22c55e44' : 'var(--se-border)'}`,
            }}>
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'pulse-dot' : ''}`}
              style={{ background: connected ? '#4ade80' : '#374151' }} />
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
              color: connected ? '#4ade80' : 'var(--se-muted)',
            }}>
              {connected ? 'Extension Connected' : 'Extension Disconnected'}
            </span>
          </div>
        </div>

        {/* Show name + refresh button */}
        <div className="flex items-center gap-2" style={{ flex: 1, justifyContent: 'center' }}>
          {showName ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full"
              style={{ background: 'var(--se-surface2)', border: '1px solid var(--se-border)', maxWidth: 320 }}>
              <span style={{ fontSize: 10, color: 'var(--se-teal)', fontWeight: 700, letterSpacing: '0.06em', flexShrink: 0 }}>
                LIVE
              </span>
              <span style={{
                fontSize: 12, fontWeight: 600, color: 'var(--se-text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {showName}
              </span>
            </div>
          ) : connected ? (
            <span style={{ fontSize: 11, color: 'var(--se-muted)' }}>No show detected</span>
          ) : null}

          <button
            onClick={refreshShow}
            title="Reconnect and refresh show name"
            style={{
              background: 'transparent',
              border: '1px solid var(--se-border)',
              color: 'var(--se-muted)',
              borderRadius: 6,
              width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 13,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--se-blue)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--se-text)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--se-border)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--se-muted)';
            }}
            onMouseDown={e => (e.currentTarget as HTMLButtonElement).style.transform = 'rotate(180deg)'}
            onMouseUp={e => (e.currentTarget as HTMLButtonElement).style.transform = 'rotate(0deg)'}
          >
            ↻
          </button>
        </div>

        <div className="flex items-center gap-1">
          {(['dashboard', 'settings', 'accounts'] as const).map(p => (
            <button key={p} onClick={() => setPage(p)} className="btn-ghost"
              style={page === p ? { borderColor: 'var(--se-blue)', color: 'var(--se-text)' } : {}}>
              {p === 'dashboard' ? '🖨 Dashboard' : p === 'settings' ? '⚙ Settings' : '👤 Accounts'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {page === 'dashboard' && <Dashboard />}
        {page === 'settings'  && <Settings  />}
        {page === 'accounts'  && <Accounts  />}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppState>
      <Inner />
    </AppState>
  );
}
