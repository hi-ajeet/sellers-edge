import { useState } from 'react';
import { useApp, Job } from '../store/appState';
import ManualAddModal from '../components/ManualAddModal';
import SessionSummaryModal from '../components/SessionSummaryModal';

const api = (window as any).sellersEdge;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function JobStatusIcon({ status }: { status: string }) {
  if (status === 'printed')  return <span title="Printed"  style={{ fontSize: 14 }}>✅</span>;
  if (status === 'failed')   return <span title="Failed"   style={{ fontSize: 14 }}>❌</span>;
  if (status === 'printing') return <span title="Printing" style={{ fontSize: 14 }} className="pulse-dot">🖨</span>;
  return                            <span title="Queued"   style={{ fontSize: 14 }} className="pulse-dot">⏳</span>;
}

function SourceBadge({ source }: { source?: string }) {
  if (!source || source === 'manual') return null;
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, letterSpacing: '0.05em',
      padding: '2px 5px', borderRadius: 3, flexShrink: 0,
      background: 'rgba(10,100,223,0.15)', color: 'var(--se-blue)',
      border: '1px solid rgba(10,100,223,0.3)',
    }}>
      LIVE
    </span>
  );
}

export default function Dashboard() {
  const {
    jobs, connected, paused, setPaused, printerOffline,
    soldCount, giveawayCount, failedCount, pendingCount,
    reprintJob, sessionId, clearLog,
  } = useApp();

  const [showManual, setShowManual] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [hoveredJob, setHoveredJob] = useState<string | null>(null);

  const handleExport = async () => {
    const csv = await api?.exportCSV(sessionId);
    if (!csv) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `SellersEdge_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="flex flex-col h-full p-4 gap-3" style={{ background: 'var(--se-bg)' }}>

      {/* ── Status bar ── */}
      <div className="flex items-center justify-between px-4 py-2 rounded-lg"
        style={{ background: 'var(--se-surface)', border: '1px solid var(--se-border)' }}>

        <div className="flex items-center gap-4">
          {/* Connection */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'pulse-dot' : ''}`}
              style={{ background: connected ? '#4ade80' : '#374151' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: connected ? '#4ade80' : 'var(--se-muted)' }}>
              {connected ? 'Live — receiving orders' : 'Waiting for extension...'}
            </span>
          </div>

          {/* Pending queue warning */}
          {pendingCount > 0 && (
            <>
              <div style={{ width: 1, height: 14, background: 'var(--se-border)' }} />
              <span style={{ fontSize: 12, color: 'var(--se-giveaway)', fontWeight: 700 }}>
                ⏳ {pendingCount} job{pendingCount > 1 ? 's' : ''} queued
              </span>
            </>
          )}

          {printerOffline && (
            <>
              <div style={{ width: 1, height: 14, background: 'var(--se-border)' }} />
              <span style={{ fontSize: 12, color: 'var(--se-error)', fontWeight: 700 }}>
                🖨 Printer offline — retrying…
              </span>
            </>
          )}

          {/* Paused indicator */}
          {paused && (
            <>
              <div style={{ width: 1, height: 14, background: 'var(--se-border)' }} />
              <span style={{ fontSize: 12, color: 'var(--se-giveaway)', fontWeight: 700 }}>⏸ Printing paused</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={() => setShowManual(true)}>+ Add Manual</button>
          <button className="btn-ghost" onClick={() => setPaused(!paused)}
            style={paused ? { borderColor: 'var(--se-giveaway)', color: 'var(--se-giveaway)' } : {}}>
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex gap-4 flex-1 overflow-hidden">

        {/* Stats sidebar */}
        <div className="flex flex-col gap-3" style={{ width: 170, flexShrink: 0 }}>
          <StatCard label="SOLD"     value={soldCount}     color="var(--se-sold)"     icon="🏷" />
          <StatCard label="GIVEAWAY" value={giveawayCount} color="var(--se-giveaway)" icon="🎁" />
          <StatCard label="FAILED"   value={failedCount}   color="var(--se-error)"    icon="⚠" />
          <StatCard label="TOTAL"    value={soldCount + giveawayCount} color="var(--se-blue)" icon="📊" />

          <div className="mt-auto flex flex-col gap-2">
            <button className="btn-ghost w-full" style={{ fontSize: 12 }} onClick={handleExport}>
              📄 Export CSV
            </button>
            <button className="btn-primary w-full" style={{ fontSize: 12 }} onClick={() => setShowSummary(true)}>
              End Session
            </button>
          </div>
        </div>

        {/* Print log */}
        <div className="flex-1 flex flex-col rounded-lg overflow-hidden"
          style={{ background: 'var(--se-surface)', border: '1px solid var(--se-border)' }}>

          {/* Log header */}
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid var(--se-border)', flexShrink: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--se-muted)', letterSpacing: '0.08em' }}>
              LIVE PRINT LOG
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--se-muted)' }}>
                {jobs.length} label{jobs.length !== 1 ? 's' : ''} this session
              </span>
              {jobs.length > 0 && (
                <button
                  onClick={() => { if (window.confirm('Clear the log? This only removes items from the screen — they stay saved in the database.')) clearLog(); }}
                  className="btn-ghost"
                  style={{ fontSize: 11, padding: '3px 8px' }}>
                  Clear log
                </button>
              )}
            </div>
          </div>

          {/* Log rows */}
          <div className="flex-1 overflow-y-auto">
            {jobs.length === 0 ? (
              <EmptyState connected={connected} />
            ) : (
              jobs.map(job => (
                <JobRow
                  key={job.job_id}
                  job={job}
                  hovered={hoveredJob === job.job_id}
                  onHover={setHoveredJob}
                  onReprint={reprintJob}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {showManual  && <ManualAddModal         onClose={() => setShowManual(false)} />}
      {showSummary && <SessionSummaryModal     onClose={() => setShowSummary(false)} />}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function JobRow({ job, hovered, onHover, onReprint }: {
  job: Job;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onReprint: (id: string) => void;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 log-row-enter"
      style={{
        borderBottom: '1px solid var(--se-border)',
        background: hovered ? 'var(--se-surface2)' : 'transparent',
        transition: 'background 0.12s',
      }}
      onMouseEnter={() => onHover(job.job_id)}
      onMouseLeave={() => onHover(null)}>

      <JobStatusIcon status={job.status} />

      <span style={{
        fontSize: 11, color: 'var(--se-muted)', width: 56,
        flexShrink: 0, fontVariantNumeric: 'tabular-nums',
      }}>
        {formatTime(job.created_at)}
      </span>

      <span style={{
        fontWeight: 700, color: 'var(--se-blue)', fontSize: 13,
        width: 130, flexShrink: 0, overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        @{job.username}
      </span>

      <span style={{
        fontSize: 13, flex: 1, color: 'var(--se-text)',
        overflow: 'hidden', textOverflow: 'ellipsis',
        whiteSpace: 'nowrap', minWidth: 0,
      }}>
        {job.item_description}
      </span>

      <span style={{
        fontSize: 14, fontWeight: 800, color: 'var(--se-text)',
        width: 60, textAlign: 'right', flexShrink: 0,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {job.sale_type === 'GIVEAWAY' ? '' : `$${job.price.toFixed(2)}`}
      </span>

      <div className={job.sale_type === 'SOLD' ? 'badge-sold' : 'badge-giveaway'} style={{ flexShrink: 0 }}>
        {job.sale_type}
      </div>

      <SourceBadge source={job.source} />

      {job.is_reprint && (
        <span style={{ fontSize: 9, color: 'var(--se-muted)', fontStyle: 'italic', flexShrink: 0 }}>REPRINT</span>
      )}

      <button
        onClick={() => onReprint(job.job_id)}
        className="btn-ghost"
        title="Reprint this label"
        style={{
          fontSize: 11, padding: '3px 8px', flexShrink: 0,
          opacity: hovered ? 1 : 0, transition: 'opacity 0.12s',
        }}>
        ↺
      </button>
    </div>
  );
}

function EmptyState({ connected }: { connected: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3"
      style={{ color: 'var(--se-muted)' }}>
      <div style={{ fontSize: 52 }}>🖨</div>
      <div style={{ fontSize: 15, fontWeight: 700 }}>
        {connected ? 'Waiting for orders...' : 'Extension not connected'}
      </div>
      <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 280, lineHeight: 1.7 }}>
        {connected
          ? 'Labels print automatically the moment something sells or is given away on your live stream.'
          : 'Open Whatnot in your browser with the Sellers Edge extension installed, then start your live show.'}
      </div>
      {!connected && (
        <div className="flex flex-col gap-1 mt-2"
          style={{ fontSize: 11, color: 'var(--se-muted)', textAlign: 'center', lineHeight: 1.8 }}>
          <div>1. Install the Sellers Edge browser extension</div>
          <div>2. Go to whatnot.com and open your seller dashboard</div>
          <div>3. The connection indicator above will turn green</div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, icon }: {
  label: string; value: number; color: string; icon: string;
}) {
  return (
    <div className="rounded-lg px-4 py-3 flex items-center justify-between"
      style={{ background: 'var(--se-surface)', border: '1px solid var(--se-border)' }}>
      <div>
        <div style={{ fontSize: 10, color: 'var(--se-muted)', fontWeight: 700, letterSpacing: '0.1em' }}>
          {label}
        </div>
        <div className="brand-font" style={{ fontSize: 30, color, lineHeight: 1.1 }}>{value}</div>
      </div>
      <span style={{ fontSize: 22 }}>{icon}</span>
    </div>
  );
}
