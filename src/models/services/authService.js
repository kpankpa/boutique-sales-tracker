import { AppError } from '../errors';
import { checkPassword } from '../security';
import { currentSession, endSession, startSession } from '../session';
import { findUserById, findUserByUsername } from '../repositories/users';

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    branchId: user.branch_id ?? null
  };
}

export async function signIn({ username, password, pin }) {
  const user = await findUserByUsername(String(username ?? '').trim().toLowerCase());
  if (!user || !user.active) {
    throw new AppError('Incorrect username or password.', 'INVALID_CREDENTIALS');
  }

  const passwordMatches = password ? checkPassword(password, user.password_hash) : false;
  const pinMatches = user.role === 'cashier' && pin ? checkPassword(pin, user.pin_hash) : false;
  if (!passwordMatches && !pinMatches) {
    throw new AppError('Incorrect username or password.', 'INVALID_CREDENTIALS');
  }

  await startSession(user);
  return publicUser(user);
}

export async function signedInUser() {
  const session = await currentSession();
  if (!session?.userId) return null;
  const user = await findUserById(session.userId);
  if (!user || !user.active) return null;
  return publicUser(user);
}

export async function signOut() {
  await endSession();
}
