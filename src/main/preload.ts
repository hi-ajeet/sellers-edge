import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('sellersEdge', {
  // Settings
  getSettings:   ()       => ipcRenderer.invoke('get-settings'),
  saveSettings:  (s: any) => ipcRenderer.invoke('save-settings', s),

  // Accounts
  getAccounts:   ()       => ipcRenderer.invoke('get-accounts'),
  saveAccount:   (a: any) => ipcRenderer.invoke('save-account', a),
  deleteAccount: (id: number) => ipcRenderer.invoke('delete-account', id),

  // Jobs & sessions
  getSessionLogs: (sid: string) => ipcRenderer.invoke('get-session-logs', sid),
  getAllSessions:  ()            => ipcRenderer.invoke('get-all-sessions'),
  reprintJob:     (id: string)  => ipcRenderer.invoke('reprint-job', id),
  addManualJob:   (o: any)      => ipcRenderer.invoke('add-manual-job', o),
  exportCSV:      (sid: string) => ipcRenderer.invoke('export-csv', sid),
  newSession:     ()            => ipcRenderer.invoke('new-session'),
  testPrint:      ()            => ipcRenderer.invoke('test-print'),

  // Printer & files
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  selectLogo:  () => ipcRenderer.invoke('select-logo'),

  // Security
  verifyPin: (pin: string) => ipcRenderer.invoke('verify-pin', pin),
  setPin:    (pin: string) => ipcRenderer.invoke('set-pin', pin),

  // ── Events ────────────────────────────────────────────────────────────────
  onNewPrintJob: (cb: (job: any) => void) => {
    const h = (_: any, j: any) => cb(j);
    ipcRenderer.on('new-print-job', h);
    return () => ipcRenderer.removeListener('new-print-job', h);
  },
  onJobUpdate: (cb: (job: any) => void) => {
    const h = (_: any, j: any) => cb(j);
    ipcRenderer.on('job-update', h);
    return () => ipcRenderer.removeListener('job-update', h);
  },
  onPrinterOffline: (cb: () => void) => {
    ipcRenderer.on('printer-offline', cb);
    return () => ipcRenderer.removeListener('printer-offline', cb);
  },
  onExtensionStatus: (cb: (s: { connected: boolean }) => void) => {
    const h = (_: any, s: any) => cb(s);
    ipcRenderer.on('extension-status', h);
    return () => ipcRenderer.removeListener('extension-status', h);
  },
  onUpdateDownloaded: (cb: () => void) => {
    ipcRenderer.on('update-downloaded', cb);
    return () => ipcRenderer.removeListener('update-downloaded', cb);
  },
  refreshShow: () => ipcRenderer.invoke('refresh-show'),

  onShowName: (cb: (s: { name: string }) => void) => {
    const h = (_: any, s: any) => cb(s);
    ipcRenderer.on('show-name', h);
    return () => ipcRenderer.removeListener('show-name', h);
  },

  onWssPortConflict: (cb: () => void) => {
    ipcRenderer.on('wss-port-conflict', cb);
    return () => ipcRenderer.removeListener('wss-port-conflict', cb);
  },
});
