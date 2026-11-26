// Compact, versioned QR payload for product labels.
//
// Legacy labels contain only a barcode or SKU. New labels carry a small JSON
// object so scanning one can fill the Admin product form even for an item that
// is not in the catalogue yet. Plain codes still work through the normal
// catalogue lookup path.
const PREFIX = 'SW1:';
// Labels printed before the Sneakwise rebrand still carry this prefix.
const LEGACY_PREFIX = 'SLAWN1:';
const MAX_DECODE_LENGTH = 2000;

function toBase64Url(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function compactNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
}

export function productQrValue(product) {
  if (!product) return '';
  const payload = {
    v: 1,
    s: String(product.sku || '').trim(),
    n: String(product.name || '').trim(),
    c: String(product.category || 'other').trim(),
    z: String(product.size || '').trim(),
    b: String(product.barcode || '').trim(),
    p: compactNumber(product.price),
    k: compactNumber(product.cost)
  };
  return `${PREFIX}${toBase64Url(JSON.stringify(payload))}`;
}

export function decodeProductQr(raw) {
  const value = String(raw || '').trim();
  const prefix = value.startsWith(PREFIX) ? PREFIX : value.startsWith(LEGACY_PREFIX) ? LEGACY_PREFIX : null;
  if (!prefix || value.length > MAX_DECODE_LENGTH) return null;
  try {
    const payload = JSON.parse(fromBase64Url(value.slice(prefix.length)));
    if (payload?.v !== 1) return null;
    if (!payload.n || typeof payload.n !== 'string') return null;
    if (!payload.s || typeof payload.s !== 'string') return null;
    return {
      sku: payload.s.slice(0, 128),
      name: payload.n.slice(0, 200),
      category: typeof payload.c === 'string' ? payload.c.slice(0, 64) : 'other',
      size: typeof payload.z === 'string' ? payload.z.slice(0, 64) : '',
      barcode: typeof payload.b === 'string' ? payload.b.slice(0, 64) : '',
      price: compactNumber(payload.p),
      cost: compactNumber(payload.k)
    };
  } catch {
    return null;
  }
}
