import { AppError } from '../errors';
import { addShopEvent, isAllowedShopEvent, listShopEventSummary } from '../repositories/shopEvents';

const MAX_SESSION_KEY = 64;
const MAX_CATEGORY = 40;
const MAX_META_KEYS = 6;

function cleanSessionKey(value) {
  const key = String(value || '').trim().slice(0, MAX_SESSION_KEY);
  return /^[a-zA-Z0-9_-]+$/.test(key) ? key : '';
}

function cleanCategory(value) {
  return String(value || '').trim().slice(0, MAX_CATEGORY) || null;
}

function cleanMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const out = {};
  for (const [key, raw] of Object.entries(meta).slice(0, MAX_META_KEYS)) {
    if (!/^[a-zA-Z0-9_]{1,24}$/.test(key)) continue;
    if (typeof raw === 'string') out[key] = raw.slice(0, 40);
    else if (typeof raw === 'number' && Number.isFinite(raw)) out[key] = Math.round(raw * 100) / 100;
    else if (typeof raw === 'boolean') out[key] = raw;
  }
  return Object.keys(out).length ? out : null;
}

export async function recordShopEvent(input = {}) {
  const eventName = String(input.eventName || '').trim();
  if (!isAllowedShopEvent(eventName)) {
    throw new AppError('Unknown shop event.');
  }
  const productId = Number(input.productId);
  await addShopEvent({
    eventName,
    sessionKey: cleanSessionKey(input.sessionKey),
    productId: Number.isInteger(productId) ? productId : null,
    category: cleanCategory(input.category),
    meta: cleanMeta(input.meta)
  });
  return { ok: true };
}

export async function getShopAnalytics(days = 14) {
  return listShopEventSummary(days);
}
