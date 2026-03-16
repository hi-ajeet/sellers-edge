/**
 * Sellers Edge — Content Script v2 (Phase 2)
 * Hardened DOM selectors + Network interception fallback
 */

interface OrderEvent {
  event_id: string;
  username: string;
  item_description: string;
  price: number;
  sale_type: 'SOLD' | 'GIVEAWAY';
  timestamp: string;
  source: 'dom' | 'network';
}

const seen = new Set<string>();
let isPaused = false;
const orderCount = { sold: 0, giveaway: 0 };

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SET_PAUSED') isPaused = msg.paused;
});

// ════════════════════════════════════════════════════════════════
// STRATEGY 1: Network / GraphQL Interception
// Patches window.fetch to intercept Whatnot's GraphQL responses.
// Survives all UI redesigns — zero DOM dependency.
// ════════════════════════════════════════════════════════════════
function installNetworkInterceptor() {
  const script = document.createElement('script');
  script.textContent = `(function(){
    const _fetch = window.fetch;
    window.fetch = async function(...args){
      const res = await _fetch.apply(this, args);
      try {
        const url = typeof args[0]==='string' ? args[0] : (args[0]?.url||'');
        if(url.includes('whatnot.com') && url.includes('graphql')){
          res.clone().json().then(d=>{
            const s = JSON.stringify(d);
            if(s.includes('orderCreated')||s.includes('auctionWinner')||
               s.includes('giveawayWinner')||s.includes('"SOLD"')){
              window.dispatchEvent(new CustomEvent('se:gql',{detail:d}));
            }
          }).catch(()=>{});
        }
      } catch(e){}
      return res;
    };
  })();`;
  (document.head || document.documentElement).appendChild(script);
  script.remove();

  window.addEventListener('se:gql', (e: any) => {
    try { parseGraphQLData(e.detail); } catch {}
  });
}

function parseGraphQLData(obj: any) {
  if (!obj || typeof obj !== 'object') return;
  if (obj.buyer?.username && (obj.listing || obj.product)) {
    const l = obj.listing || obj.product || {};
    const isGiveaway = l.__typename === 'GiveawayListing';
    dispatchOrder({
      username: obj.buyer.username,
      item_description: l.title || l.name || 'Unknown Item',
      price: parseFloat(l.currentPrice?.amount || l.price?.amount || '0') || 0,
      sale_type: isGiveaway ? 'GIVEAWAY' : 'SOLD',
      source: 'network',
    });
    return;
  }
  for (const key of Object.keys(obj)) {
    if (Array.isArray(obj[key])) obj[key].forEach(parseGraphQLData);
    else if (typeof obj[key] === 'object') parseGraphQLData(obj[key]);
  }
}

// ════════════════════════════════════════════════════════════════
// STRATEGY 2: DOM MutationObserver
// Layered selectors — tries most specific first, falls back wider.
// ════════════════════════════════════════════════════════════════
const FEED_SELECTORS = [
  '[data-testid="sold-feed"]','[data-testid="order-feed"]',
  '[data-testid="sales-feed"]','[data-testid="live-orders"]',
  '[class*="SoldFeed"]','[class*="OrderFeed"]','[class*="SalesFeed"]',
  '[class*="sold-feed"]','[class*="order-feed"]','[class*="sales-feed"]',
  '[class*="LiveSales"]','[class*="live-sales"]',
  '[aria-label*="sold"]','[aria-label*="orders"]',
];

const ROW_SELECTORS = [
  '[data-testid*="order-row"]','[data-testid*="sale-row"]','[data-testid*="sold-item"]',
  '[class*="OrderRow"]','[class*="SaleRow"]','[class*="SoldItem"]',
  '[class*="order-row"]','[class*="sale-row"]','[class*="sold-item"]',
  '[class*="order-card"]','[class*="OrderCard"]',
];

const USERNAME_SELECTORS = [
  '[data-testid="buyer-username"]','[data-testid="username"]',
  '[class*="BuyerName"]','[class*="buyer-name"]','[class*="Username"]',
  'a[href*="/user/"]','a[href*="/@"]',
];

const ITEM_SELECTORS = [
  '[data-testid="item-title"]','[data-testid="listing-title"]',
  '[class*="ItemTitle"]','[class*="ListingTitle"]',
  '[class*="item-title"]','[class*="listing-title"]','[class*="product-name"]',
];

const PRICE_SELECTORS = [
  '[data-testid="sale-price"]','[data-testid="winning-bid"]',
  '[class*="SalePrice"]','[class*="WinningBid"]',
  '[class*="sale-price"]','[class*="winning-bid"]',
];

function q(el: Element | Document, sels: string[]): Element | null {
  for (const s of sels) { try { const r = el.querySelector(s); if (r) return r; } catch {} }
  return null;
}

function extractOrder(el: Element): OrderEvent | null {
  try {
    let username = q(el, USERNAME_SELECTORS)?.textContent?.trim().replace(/^@/,'') || '';
    if (!username) { const m = (el.textContent||'').match(/@([a-zA-Z0-9_.]+)/); if(m) username=m[1]; }

    let item = q(el, ITEM_SELECTORS)?.textContent?.trim() || '';
    if (!item) {
      item = Array.from(el.querySelectorAll('span,p'))
        .map(s=>s.textContent?.trim()||'')
        .filter(t=>t.length>5&&t.length<120&&!t.startsWith('@')&&!/^\$[\d.,]+$/.test(t))
        .sort((a,b)=>b.length-a.length)[0] || '';
    }

    if (!username || !item) return null;

    let price = 0;
    const pt = (q(el,PRICE_SELECTORS)?.textContent || el.textContent || '').match(/\$\s*([\d,]+\.?\d*)/);
    if (pt) price = parseFloat(pt[1].replace(',',''));

    const txt = (el.textContent||'').toLowerCase();
    const cls = (el.className||'').toLowerCase();
    const isGiveaway = txt.includes('giveaway') || cls.includes('giveaway') || price===0;

    return {
      event_id: `dom-${username}-${item.slice(0,20)}-${Date.now()}`,
      username, item_description: item.slice(0,120), price,
      sale_type: isGiveaway ? 'GIVEAWAY' : 'SOLD',
      timestamp: new Date().toISOString(), source: 'dom',
    };
  } catch { return null; }
}

function dispatchOrder(partial: Partial<OrderEvent> & Pick<OrderEvent,'username'|'item_description'|'sale_type'>) {
  if (isPaused) return;

  const dedupKey = `${partial.username}|${partial.item_description.slice(0,30)}`;
  if (seen.has(dedupKey)) return;
  seen.add(dedupKey);
  setTimeout(() => seen.delete(dedupKey), 6000);

  const order: OrderEvent = {
    event_id: partial.event_id || `${partial.source||'dom'}-${partial.username}-${Date.now()}`,
    username: partial.username,
    item_description: partial.item_description,
    price: partial.price ?? 0,
    sale_type: partial.sale_type,
    timestamp: partial.timestamp || new Date().toISOString(),
    source: partial.source || 'dom',
  };

  if (order.sale_type === 'SOLD') orderCount.sold++;
  else orderCount.giveaway++;
  chrome.storage.local.set({ soldCount: orderCount.sold, giveawayCount: orderCount.giveaway });
  chrome.runtime.sendMessage({ type: 'ORDER_EVENT', payload: order });
}

function startObserver() {
  let feed: Element | null = null;
  for (const s of FEED_SELECTORS) { try { feed = document.querySelector(s); if(feed) break; } catch {} }

  if (!feed) { setTimeout(startObserver, 2000); return; }

  console.log('[SellersEdge] Observer attached to feed');
  new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of Array.from(m.addedNodes)) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        const el = node as Element;
        const o = extractOrder(el);
        if (o) { dispatchOrder(o); continue; }
        for (const rs of ROW_SELECTORS) {
          try { el.querySelectorAll(rs).forEach(r => { const o2=extractOrder(r); if(o2) dispatchOrder(o2); }); } catch {}
        }
      }
    }
  }).observe(feed, { childList: true, subtree: true });
}

// ── Init ─────────────────────────────────────────────────────────
const url = window.location.href;
if (url.includes('/dashboard')||url.includes('/live')||url.includes('/show')||url.includes('/seller-hub')) {
  installNetworkInterceptor();
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', startObserver)
    : startObserver();
  console.log('[SellersEdge] Phase 2 content script active');
}

// ── Show name detection ───────────────────────────────────────────────────────
// Scrapes the current Whatnot show title from the page and sends it to the
// background whenever it changes or a refresh is requested.

function detectShowName(): string {
  // Multiple selector strategies for the show title
  const selectors = [
    '[data-testid="show-title"]',
    '[data-testid="stream-title"]',
    '[data-testid="live-title"]',
    'h1[class*="title"]',
    'h1[class*="show"]',
    '[class*="ShowTitle"]',
    '[class*="StreamTitle"]',
    '[class*="LiveTitle"]',
    '[class*="show-title"]',
    '[class*="stream-title"]',
    // Fallback: look for the biggest h1 on the page
    'h1',
  ];

  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      const text = el?.textContent?.trim();
      if (text && text.length > 2 && text.length < 120) return text;
    } catch {}
  }

  // Try page title as last resort
  const pageTitle = document.title?.replace(' | Whatnot', '').replace(' - Whatnot', '').trim();
  if (pageTitle && pageTitle !== 'Whatnot') return pageTitle;

  return '';
}

let lastShowName = '';

function sendShowName(force = false) {
  const name = detectShowName();
  if (!name) return;
  if (!force && name === lastShowName) return;
  lastShowName = name;
  chrome.runtime.sendMessage({ type: 'SHOW_NAME', name });
}

// Send on load and watch for title changes
sendShowName(true);

// Watch for DOM changes that might update the show title
const titleObserver = new MutationObserver(() => sendShowName());
titleObserver.observe(document.head, { childList: true, subtree: true });

// Also watch body for dynamic title updates
const bodyObserver = new MutationObserver(() => sendShowName());
setTimeout(() => {
  if (document.body) bodyObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
}, 2000);

// Listen for refresh request from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'REQUEST_SHOW_NAME') sendShowName(true);
});
