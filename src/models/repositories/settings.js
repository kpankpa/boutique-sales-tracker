import { database } from '../database';

export async function getSetting(key) {
  const result = await database.execute({
    sql: 'SELECT value FROM settings WHERE key = ?',
    args: [key]
  });
  return result.rows[0]?.value ?? null;
}

export async function setSetting(key, value) {
  await database.execute({
    sql: `INSERT INTO settings (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    args: [key, String(value)]
  });
}

export async function isInstalled() {
  try {
    return (await getSetting('installed')) === '1';
  } catch (failure) {
    // A database outage is not an uninstalled application. Callers have
    // already ensured the schema, so surface the real infrastructure error.
    console.error('[settings] Could not read install state', failure);
    throw failure;
  }
}
