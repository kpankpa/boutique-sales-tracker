import { makeOrderRef } from './whatsapp';

const REFERENCE_KEY = 'sneakwise.shop.reference.v1';

function valid(reference) {
  return /^SW-\d{6}-[A-Z0-9]{4}$/.test(String(reference || ''));
}

export function getOrderReference() {
  if (typeof window === 'undefined') return '';
  try {
    const existing = window.localStorage.getItem(REFERENCE_KEY);
    if (valid(existing)) return existing;
    const created = makeOrderRef();
    window.localStorage.setItem(REFERENCE_KEY, created);
    return created;
  } catch {
    return makeOrderRef();
  }
}

export function rotateOrderReference() {
  if (typeof window === 'undefined') return '';
  const created = makeOrderRef();
  try { window.localStorage.setItem(REFERENCE_KEY, created); } catch {}
  return created;
}
