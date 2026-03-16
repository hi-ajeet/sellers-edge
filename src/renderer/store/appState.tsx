import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';

const api = (window as any).sellersEdge;

export interface Job {
  job_id:           string;
  username:         string;
  item_description: string;
  price:            number;
  sale_type:        'SOLD' | 'GIVEAWAY';
  status:           'pending' | 'printing' | 'printed' | 'failed';
  created_at:       string;
  is_reprint:       boolean;
  source?:          'extension' | 'manual';
}

interface AppCtx {
  jobs:           Job[];
  connected:      boolean;
  paused:         boolean;
  setPaused:      (v: boolean) => void;
  sessionId:      string;
  soldCount:      number;
  giveawayCount:  number;
  failedCount:    number;
  pendingCount:   number;
  reprintJob:     (id: string) => void;
  addManualJob:   (order: any) => void;
  endSession:     () => Promise<void>;
  clearLog:       () => void;
  showUpdateBanner: boolean;
  printerOffline: boolean;
  showName: string;
  refreshShow: () => void;
}

const Ctx = createContext<AppCtx>(null!);
export const useApp = () => useContext(Ctx);

export function AppState({ children }: { children: ReactNode }) {
  const [jobs,             setJobs]             = useState<Job[]>([]);
  const [connected,        setConnected]        = useState(false);
  const [paused,           setPaused]           = useState(false);
  const [sessionId,        setSessionId]        = useState(`session-${Date.now()}`);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [printerOffline,    setPrinterOffline]    = useState(false);
  const [showName,           setShowName]           = useState('');
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    if (!api) return;
    const unsubs = [
      api.onNewPrintJob((job: Job) => {
        if (pausedRef.current) return;
        setJobs(prev => [job, ...prev]);
        playSound(job.sale_type);
      }),
      api.onJobUpdate((updated: Job) => {
        setJobs(prev => prev.map(j => j.job_id === updated.job_id ? { ...j, ...updated } : j));
      }),
      api.onExtensionStatus((s: { connected: boolean }) => setConnected(s.connected)),
      api.onUpdateDownloaded(() => setShowUpdateBanner(true)),
      // FIX 13: WSS port conflict toast
      api.onWssPortConflict?.(() => {
        console.warn('WebSocket port conflict — change in Settings > App');
      }),
    ];
    return () => unsubs.forEach(u => u?.());
  }, []);

  const playSound = useCallback(async (saleType?: string) => {
    try {
      const settings = await api?.getSettings();
      if (settings?.sound_enabled === 'false') return;
      const vol  = parseFloat(settings?.sound_volume || '0.7');
      const file = saleType === 'GIVEAWAY'
        ? '/sounds/print-beep-giveaway.wav'
        : '/sounds/print-beep-sold.wav';
      const audio = new Audio(file);
      audio.volume = vol;
      audio.play().catch(() => {
        // Fallback to Web Audio API beep
        try {
          const ctx  = new AudioContext();
          const osc  = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = saleType === 'GIVEAWAY' ? 660 : 880;
          gain.gain.setValueAtTime(vol * 0.6, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
          osc.start();
          osc.stop(ctx.currentTime + 0.25);
        } catch {}
      });
    } catch {}
  }, []);

  const reprintJob = useCallback(async (id: string) => {
    await api?.reprintJob(id);
  }, []);

  const addManualJob = useCallback(async (order: any) => {
    await api?.addManualJob({ ...order, session_id: sessionId });
  }, [sessionId]);

  // FIX 4: endSession — calls main process, resets local state
  const refreshShow = useCallback(async () => {
    await api?.refreshShow?.();
  }, []);

  const endSession = useCallback(async () => {
    const newId = await api?.newSession();
    if (newId) setSessionId(newId);
    setJobs([]);
  }, []);

  // Clears the on-screen log only — jobs stay saved in the database
  const clearLog = useCallback(() => {
    setJobs([]);
  }, []);

  const soldCount     = jobs.filter(j => j.sale_type === 'SOLD'     && !j.is_reprint).length;
  const giveawayCount = jobs.filter(j => j.sale_type === 'GIVEAWAY' && !j.is_reprint).length;
  const failedCount   = jobs.filter(j => j.status === 'failed').length;
  const pendingCount  = jobs.filter(j => j.status === 'pending' || j.status === 'printing').length;

  return (
    <Ctx.Provider value={{
      jobs, connected, paused, setPaused, sessionId,
      soldCount, giveawayCount, failedCount, pendingCount,
      reprintJob, addManualJob, endSession, clearLog,
      showUpdateBanner, printerOffline, showName, refreshShow,
    }}>
      {children}
    </Ctx.Provider>
  );
}
