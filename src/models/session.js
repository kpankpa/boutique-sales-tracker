import { cookies } from 'next/headers';
import { createToken, readToken } from './security';

const cookieName = 'slawn_session';
const sessionLifetime = 60 * 60 * 8;

export async function currentSession() {
  const jar = await cookies();
  return readToken(jar.get(cookieName)?.value);
}

export async function startSession(user) {
  const jar = await cookies();
  const payload = {
    userId: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    branchId: user.branch_id ?? null
  };
  jar.set(cookieName, createToken(payload, sessionLifetime), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: sessionLifetime
  });
}

export async function endSession() {
  const jar = await cookies();
  jar.set(cookieName, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0
  });
}
