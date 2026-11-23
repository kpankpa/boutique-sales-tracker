import { AppError } from '../errors';
import {
  clearLoginAttempt,
  findLoginAttempt,
  pruneLoginAttempts,
  saveLoginAttempt
} from '../repositories/loginAttempts';

const maxFailures = Math.max(1, Number(process.env.LOGIN_MAX_ATTEMPTS) || 5);
const windowMs = 15 * 60 * 1000;
const lockMs = 15 * 60 * 1000;

function timestamp(value) {
  if (!value) return 0;
  const text = String(value).replace(' ', 'T');
  return new Date(text.endsWith('Z') ? text : `${text}Z`).getTime();
}

function clientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

export function loginKey(request, username) {
  return `${clientIp(request)}|${String(username ?? '').trim().toLowerCase()}`;
}

export async function checkLoginLock(key) {
  await pruneLoginAttempts();
  const attempt = await findLoginAttempt(key);
  const lockedUntil = timestamp(attempt?.locked_until);

  if (lockedUntil > Date.now()) {
    const minutes = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60000));
    throw new AppError(
      `Too many failed sign-ins. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      'LOGIN_LOCKED'
    );
  }
  return attempt;
}

export async function noteFailedLogin(key, previous) {
  const recent = timestamp(previous?.updated_at) > Date.now() - windowMs;
  const failures = (recent ? Number(previous.failures) : 0) + 1;
  const lockedUntil = failures >= maxFailures
    ? new Date(Date.now() + lockMs).toISOString()
    : null;
  await saveLoginAttempt(key, failures, lockedUntil);
}

export async function clearFailedLogins(key) {
  await clearLoginAttempt(key);
}
