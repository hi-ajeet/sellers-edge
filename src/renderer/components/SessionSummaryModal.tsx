import { useApp } from '../store/appState';

const api = (window as any).sellersEdge;

export default function SessionSummaryModal({ onClose }: { onClose: () => void }) {
  const { jobs, soldCount, giveawayCount, failedCount, sessionId, endSession } = useApp();
  const total    = jobs.filter(j => !j.is_reprint).length;
  const reprints = jobs.filter(j =>  j.is_reprint).length;

  const handleExport = async () => {
    const csv = await api?.exportCSV(sessionId);
    if (!csv) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `SellersEdge_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // FIX 4: End Session calls newSession + clears jobs
  const handleEndSession = async () => {
    await handleExport();
    await endSession();
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>

      <div className="rounded-xl p-7 w-[420px]"
        style={{ background: 'var(--se-surface)', border: '1px solid var(--se-border)' }}>

        <div className="flex items-center gap-3 mb-6">
          <div style={{ fontSize: 32 }}>📊</div>
          <div>
            <div className="brand-font text-2xl" style={{ color: 'var(--se-text)' }}>SESSION SUMMARY</div>
            <div style={{ fontSize: 12, color: 'var(--se-muted)' }}>
              {new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <Tile label="TOTAL LABELS" value={total}         color="var(--se-blue)"     />
          <Tile label="SOLD"         value={soldCount}     color="var(--se-sold)"     />
          <Tile label="GIVEAWAYS"    value={giveawayCount} color="var(--se-giveaway)" />
          <Tile label="FAILED"       value={failedCount}   color="var(--se-error)"    />
        </div>

        {reprints > 0 && (
          <div className="mb-4 px-3 py-2 rounded-lg text-xs"
            style={{ background: 'var(--se-surface2)', color: 'var(--se-muted)' }}>
            + {reprints} reprint{reprints !== 1 ? 's' : ''} (not counted in totals)
          </div>
        )}

        <div className="flex gap-3">
          <button className="btn-ghost flex-1" onClick={onClose}>Close</button>
          <button className="btn-ghost flex-1" onClick={handleExport}>📄 Export CSV</button>
          <button className="btn-primary flex-1" onClick={handleEndSession}>
            ✅ End &amp; Reset
          </button>
        </div>

        <div style={{ fontSize: 11, color: 'var(--se-muted)', marginTop: 10, textAlign: 'center' }}>
          "End &amp; Reset" exports the log and starts a fresh session
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg px-4 py-4 text-center"
      style={{ background: 'var(--se-surface2)', border: '1px solid var(--se-border)' }}>
      <div style={{ fontSize: 10, color: 'var(--se-muted)', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 4 }}>
        {label}
      </div>
      <div className="brand-font" style={{ fontSize: 44, color, lineHeight: 1 }}>{value}</div>
    </div>
  );
}
