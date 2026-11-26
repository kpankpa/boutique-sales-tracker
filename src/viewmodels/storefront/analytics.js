const SESSION_KEY = 'sneakwise.shop.session.v1';
const QUEUE_KEY = 'sneakwise.shop.events.v1';
const MAX_QUEUE = 80;

const SAFE_META_KEYS = new Set([
  'sku', 'size', 'qty', 'reference', 'source', 'method', 'delivery', 'value', 'lines'
]);

function makeSessionKey() {
  const cryptoApi = typeof window !== 'undefined' ? window.crypto : null;
  const generated = cryptoApi?.randomUUID
    ? cryptoApi.randomUUID().replace(/-/g, '')
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
  const key = String(generated).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  try { window.localStorage.setItem(SESSION_KEY, key); } catch {}
  return key;
}

function sessionKey() {
  if (typeof window === 'undefined') return '';
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    return existing || makeSessionKey();
  } catch {
    return makeSessionKey();
  }
}

function readQueue() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(-MAX_QUEUE) : [];
  } catch {
    return [];
  }
}

function writeQueue(events) {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(events.slice(-MAX_QUEUE)));
  } catch {}
}

function cleanMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {};
  const out = {};
  for (const [key, raw] of Object.entries(meta)) {
    if (!SAFE_META_KEYS.has(key)) continue;
    if (typeof raw === 'string') out[key] = raw.slice(0, 40);
    else if (typeof raw === 'number' && Number.isFinite(raw)) out[key] = Math.round(raw * 100) / 100;
    else if (typeof raw === 'boolean') out[key] = raw;
  }
  return out;
}

async function flushQueue() {
  if (typeof window === 'undefined') return;
  let queue = readQueue();
  while (queue.length) {
    const event = queue[0];
    try {
      const response = await fetch('/api/shop/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(event),
        keepalive: true
      });
      if (!response.ok) break;
      queue = queue.slice(1);
      writeQueue(queue);
    } catch {
      break;
    }
  }
}

export function trackShopEvent(eventName, payload = {}) {
  if (typeof window === 'undefined' || !eventName) return;
  const productId = Number(payload.productId);
  const event = {
    eventName,
    sessionKey: sessionKey(),
    productId: Number.isInteger(productId) && productId > 0 ? productId : null,
    category: String(payload.category || '').slice(0, 40) || null,
    meta: cleanMeta(payload.meta)
  };

  window.dispatchEvent(new CustomEvent('sneakwise:shop-event', { detail: event }));
  writeQueue([...readQueue(), event]);
  flushQueue();
}

export function shopAnalyticsSession() {
  return sessionKey();
}
