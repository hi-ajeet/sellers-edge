let paused = false;

// FIX 13: use storage.local
chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
  if (chrome.runtime.lastError || !res) return;
  updateConnectionUI(res.connected);
  updateCounts(res.soldCount || 0, res.giveawayCount || 0);
});

// Live count updates via storage.local
chrome.storage.local.get(['soldCount', 'giveawayCount'], data => {
  updateCounts(data.soldCount || 0, data.giveawayCount || 0);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  const sold     = changes.soldCount?.newValue;
  const giveaway = changes.giveawayCount?.newValue;
  if (sold     !== undefined) document.getElementById('countSold').textContent     = sold;
  if (giveaway !== undefined) document.getElementById('countGiveaway').textContent = giveaway;
});

document.getElementById('btnPause').addEventListener('click', () => {
  paused = !paused;
  chrome.runtime.sendMessage({ type: 'SET_PAUSED', paused });
  const btn = document.getElementById('btnPause');
  btn.textContent = paused ? '▶ Resume Auto-Print' : '⏸ Pause Auto-Print';
  btn.style.color       = paused ? '#22c55e' : '#f59e0b';
  btn.style.borderColor = paused ? '#22c55e44' : '#f59e0b44';
});

document.getElementById('btnReset').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'RESET_COUNTS' });
  updateCounts(0, 0);
});

function updateCounts(sold, giveaway) {
  document.getElementById('countSold').textContent     = sold;
  document.getElementById('countGiveaway').textContent = giveaway;
}

function updateConnectionUI(connected) {
  const dot  = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  dot.className  = 'dot ' + (connected ? 'connected' : 'disconnected');
  text.className = 'status-text ' + (connected ? 'connected' : 'disconnected');
  text.textContent = connected ? 'Connected to desktop app' : 'Desktop app not running';
}
