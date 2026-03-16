// Sellers Edge — Background Service Worker
// Bridges browser extension ↔ desktop app via WebSocket

const WS_PORT             = 47891;
const RECONNECT_DELAY_MS  = 3000;
const MAX_RECONNECT       = 20;

let ws:                WebSocket | null = null;
let reconnectAttempts: number          = 0;
let reconnectTimer:    ReturnType<typeof setTimeout> | null = null;
let isConnected:       boolean         = false;
const pendingQueue:    any[]           = [];
let currentShowName:   string         = '';

// ── Session counters (FIX 13: use chrome.storage.local, not .session) ────────
let soldCount     = 0;
let giveawayCount = 0;

async function loadCounts() {
  const data = await chrome.storage.local.get(['soldCount', 'giveawayCount']);
  soldCount     = data.soldCount     ?? 0;
  giveawayCount = data.giveawayCount ?? 0;
}

async function saveCounts() {
  await chrome.storage.local.set({ soldCount, giveawayCount });
}

async function resetCounts() {
  soldCount = 0; giveawayCount = 0;
  await chrome.storage.local.set({ soldCount: 0, giveawayCount: 0 });
  updateBadge();
}

loadCounts();

// ── WebSocket connection ──────────────────────────────────────────────────────
function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  try {
    ws = new WebSocket(`ws://127.0.0.1:${WS_PORT}`);

    ws.onopen = () => {
      console.log('[SE] Connected to desktop app');
      isConnected       = true;
      reconnectAttempts = 0;
      updateIcon(true);
      // Flush queued events
      while (pendingQueue.length > 0) {
        const msg = pendingQueue.shift();
        ws?.send(JSON.stringify(msg));
      }
    };

    ws.onclose = () => {
      console.log('[SE] Disconnected');
      isConnected = false;
      updateIcon(false);
      scheduleReconnect();
    };

    ws.onerror = () => {
      isConnected = false;
      updateIcon(false);
    };

  } catch (err) {
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT) return;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectAttempts++;
  const delay = Math.min(RECONNECT_DELAY_MS * reconnectAttempts, 30_000);
  reconnectTimer = setTimeout(connect, delay);
}

function sendEvent(payload: any) {
  const msg = { type: 'ORDER_EVENT', payload };
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  } else {
    if (pendingQueue.length < 200) pendingQueue.push(msg);
    connect();
  }
}

// ── Icon helpers ──────────────────────────────────────────────────────────────
function updateIcon(connected: boolean) {
  chrome.action.setIcon({
    path: connected
      ? { 16: 'icons/icon16-active.png', 48: 'icons/icon48-active.png', 128: 'icons/icon128-active.png' }
      : { 16: 'icons/icon16.png',        48: 'icons/icon48.png',        128: 'icons/icon128.png' },
  });
  chrome.action.setTitle({
    title: connected ? 'Sellers Edge — Connected ✓' : 'Sellers Edge — App not running',
  });
}

function updateBadge() {
  const total = soldCount + giveawayCount;
  chrome.action.setBadgeText({ text: total > 0 ? String(total) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#0a64df' });
}

// ── Message handler (from content script) ─────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {

  if (message.type === 'ORDER_EVENT') {
    const order = message.payload;
    sendEvent(order);

    // FIX 13: update counts correctly
    if (order.sale_type === 'GIVEAWAY') giveawayCount++;
    else soldCount++;
    saveCounts();
    updateBadge();

    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'GET_STATUS') {
    sendResponse({ connected: isConnected, pending: pendingQueue.length, soldCount, giveawayCount });
    return true;
  }

  if (message.type === 'RESET_COUNTS') {
    resetCounts();
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'SHOW_NAME') {
    currentShowName = message.name || '';
    // Forward to desktop app via WebSocket
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'SHOW_NAME', name: currentShowName }));
    }
    // Store so popup can display it
    chrome.storage.local.set({ showName: currentShowName });
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'GET_SHOW_NAME') {
    sendResponse({ name: currentShowName });
    return true;
  }

  if (message.type === 'REFRESH_SHOW') {
    // Ask content script on active Whatnot tab to re-detect show name
    chrome.tabs.query({ url: ['*://www.whatnot.com/*', '*://whatnot.com/*'] }, tabs => {
      tabs.forEach(tab => {
        if (tab.id) chrome.tabs.sendMessage(tab.id, { type: 'REQUEST_SHOW_NAME' });
      });
    });
    // Also try to reconnect WebSocket
    if (!isConnected) connect();
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'SET_PAUSED') {
    // Forward pause state to all content scripts
    chrome.tabs.query({ url: ['*://www.whatnot.com/*', '*://whatnot.com/*'] }, tabs => {
      tabs.forEach(tab => {
        if (tab.id) chrome.tabs.sendMessage(tab.id, { type: 'SET_PAUSED', paused: message.paused });
      });
    });
    sendResponse({ ok: true });
    return true;
  }
});

// ── Keep alive ────────────────────────────────────────────────────────────────
chrome.alarms.create('keepalive', { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'keepalive' && !isConnected) connect();
});

// Boot
connect();
