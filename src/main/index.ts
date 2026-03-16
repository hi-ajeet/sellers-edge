import { app, BrowserWindow, ipcMain, dialog, Notification } from 'electron';
import path from 'path';
import { WebSocketServer } from 'ws';
import { AppDatabase } from './database';
import { PrintQueue } from './printQueue';
import { LabelGenerator } from './labelGenerator';

let mainWindow: BrowserWindow | null = null;
const db         = new AppDatabase();
const labelGen   = new LabelGenerator();
const printQueue = new PrintQueue(db, labelGen);

// FIX 5+11: auto-updater — only load in production to avoid crash without publish config
let autoUpdater: any = null;
if (app.isPackaged) {
  import('electron-updater').then(({ autoUpdater: au }) => {
    autoUpdater = au;
    au.autoDownload         = true;
    au.autoInstallOnAppQuit = true;
    au.on('update-downloaded', () => {
      mainWindow?.webContents.send('update-downloaded');
      if (Notification.isSupported()) {
        new Notification({
          title: 'Sellers Edge — Update Ready',
          body:  'A new version will be installed when you quit the app.',
        }).show();
      }
    });
    au.on('error', (e: Error) => console.error('[Updater]', e.message));
    au.checkForUpdatesAndNotify().catch(() => {});
    // Recheck every 4 hours
    setInterval(() => au.checkForUpdatesAndNotify().catch(() => {}), 4 * 60 * 60 * 1000);
  }).catch(() => {});
}

// ── WebSocket server ──────────────────────────────────────────────────────────
const wss = new WebSocketServer({ port: 47891, host: '127.0.0.1' });

wss.on('connection', (ws) => {
  console.log('[WSS] Extension connected');
  mainWindow?.webContents.send('extension-status', { connected: true });

  ws.on('message', async (raw) => {
    try {
      const event = JSON.parse(raw.toString());
      if (event.type === 'SHOW_NAME') {
        mainWindow?.webContents.send('show-name', { name: event.name || '' });
        return;
      }

      if (event.type === 'ORDER_EVENT') {
        const job = await printQueue.addJob({
          ...event.payload,
          session_id: getCurrentSessionId(),
          source: event.payload.source || 'extension',
        });
        if (job) mainWindow?.webContents.send('new-print-job', job);
      }
    } catch (e) { console.error('[WSS] Parse error:', e); }
  });

  ws.on('close', () => {
    mainWindow?.webContents.send('extension-status', { connected: false });
  });

  ws.on('error', (e) => console.error('[WSS] Socket error:', e));
});

wss.on('error', (e: any) => {
  if (e.code === 'EADDRINUSE') {
    console.error('[WSS] Port 47891 already in use');
    mainWindow?.webContents.send('wss-port-conflict');
  }
});

// ── Print queue events ────────────────────────────────────────────────────────
printQueue.on('job-update', (job) => {
  mainWindow?.webContents.send('job-update', job);
});

printQueue.on('printer-offline', () => {
  mainWindow?.webContents.send('printer-offline');
  if (Notification.isSupported()) {
    new Notification({
      title: 'Sellers Edge — Printer Offline',
      body:  `${printQueue.pendingCount} job(s) queued — will retry in 15s`,
    }).show();
  }
});

// ── Session management ────────────────────────────────────────────────────────
let _sessionId: string | null = null;

function getCurrentSessionId(): string {
  if (!_sessionId) {
    _sessionId = `session-${Date.now()}`;
    db.startSession(_sessionId);
  }
  return _sessionId;
}

function startNewSession(): string {
  if (_sessionId) db.endSession(_sessionId);
  _sessionId = `session-${Date.now()}`;
  db.startSession(_sessionId);
  return _sessionId;
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────
ipcMain.handle('get-settings',     ()       => db.getSettings());
ipcMain.handle('save-settings',    (_, s)   => db.saveSettings(s));
ipcMain.handle('get-accounts',     ()       => db.getAccounts());
ipcMain.handle('save-account',     (_, a)   => db.saveAccount(a));
ipcMain.handle('delete-account',   (_, id)  => db.deleteAccount(id));
ipcMain.handle('get-session-logs', (_, sid) => db.getSessionLogs(sid));
ipcMain.handle('get-all-sessions', ()       => db.getAllSessions());
ipcMain.handle('export-csv',       (_, sid) => db.exportSessionCSV(sid));
ipcMain.handle('get-printers',     ()       => mainWindow?.webContents.getPrintersAsync() ?? []);
ipcMain.handle('verify-pin',       (_, pin) => db.verifyPin(pin));
ipcMain.handle('set-pin',          (_, pin) => db.setPin(pin));
ipcMain.handle('new-session',      ()       => startNewSession());

ipcMain.handle('reprint-job', async (_, jobId: string) => {
  const job = await printQueue.reprint(jobId);
  if (job) mainWindow?.webContents.send('new-print-job', job);
  return job;
});

ipcMain.handle('add-manual-job', async (_, order) => {
  const job = await printQueue.addJob({
    ...order,
    session_id: getCurrentSessionId(),
    source: 'manual',
  });
  if (job) mainWindow?.webContents.send('new-print-job', job);
  return job;
});

ipcMain.handle('test-print', async () => {
  try {
    const job = await printQueue.addJob({
      username:         'TestBuyer',
      item_description: 'Test Label — Sellers Edge v1.3',
      price:            9.99,
      sale_type:        'SOLD',
      session_id:       getCurrentSessionId(),
      source:           'manual',
      event_id:         `test-${Date.now()}`,
    });
    if (job) mainWindow?.webContents.send('new-print-job', job);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('refresh-show', async () => {
  // Broadcast to all extension connections to re-detect show name
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type: 'REQUEST_SHOW_NAME' }));
    }
  });
  return true;
});

ipcMain.handle('select-logo', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select Store Logo',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg'] }],
    properties: ['openFile'],
  });
  return result.filePaths[0] ?? null;
});

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100, height: 750, minWidth: 900, minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0b0f1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../../assets/icons/512x512.png'),
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  db.init();
  createWindow();
});

app.on('window-all-closed', () => {
  if (_sessionId) db.endSession(_sessionId);
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
});
