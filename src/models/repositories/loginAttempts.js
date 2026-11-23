import { database } from '../database';

export async function findLoginAttempt(key) {
  const result = await database.execute({
    sql: 'SELECT failures, locked_until, updated_at FROM login_attempts WHERE key = ?',
    args: [key]
  });
  return result.rows[0] ?? null;
}

export async function saveLoginAttempt(key, failures, lockedUntil) {
  await database.execute({
    sql: `INSERT INTO login_attempts (key, failures, locked_until)
          VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET
            failures = excluded.failures,
            locked_until = excluded.locked_until,
            updated_at = CURRENT_TIMESTAMP`,
    args: [key, failures, lockedUntil]
  });
}

export async function clearLoginAttempt(key) {
  await database.execute({
    sql: 'DELETE FROM login_attempts WHERE key = ?',
    args: [key]
  });
}

export async function pruneLoginAttempts() {
  await database.execute(
    "DELETE FROM login_attempts WHERE updated_at < datetime('now', '-1 day')"
  );
}
