import crypto from 'node:crypto';

const fallbackSecret = 'dev-only-change-this-secret';
const hashLength = 64;

function getSecret() {
  const configured = process.env.SESSION_SECRET;
  if (
    process.env.NODE_ENV === 'production' &&
    (!configured || configured === fallbackSecret || configured.length < 32)
  ) {
    throw new Error('SESSION_SECRET must be a long random value in production.');
  }
  return configured || fallbackSecret;
}

export function hashPassword(value) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(value), salt, hashLength).toString('hex');
  return `${salt}:${hash}`;
}

export function checkPassword(value, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false;
  const [salt, expected] = storedHash.split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(String(value), salt, hashLength).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export function createToken(payload, lifetimeSeconds = 60 * 60 * 8) {
  const body = Buffer.from(
    JSON.stringify({ ...payload, expiresAt: Date.now() + lifetimeSeconds * 1000 })
  ).toString('base64url');
  const signature = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function readToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  const provided = Buffer.from(signature);
  const valid = Buffer.from(expected);
  if (provided.length !== valid.length || !crypto.timingSafeEqual(provided, valid)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.expiresAt && Date.now() > payload.expiresAt) return null;
    return payload;
  } catch {
    return null;
  }
}
