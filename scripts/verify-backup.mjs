import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';

const tables = [
  'settings',
  'branches',
  'users',
  'products',
  'stock',
  'customers',
  'sales',
  'sale_lines',
  'notification_outbox',
  'audit_log',
  'login_attempts'
];

const target = process.argv[2];
if (!target) {
  console.error('Usage: node scripts/verify-backup.mjs <backup-file>');
  process.exit(1);
}

const file = path.resolve(target);
if (!fs.existsSync(file)) {
  console.error(`Backup not found: ${file}`);
  process.exit(1);
}

const client = createClient({ url: `file:${file}` });
try {
  const integrity = await client.execute('PRAGMA integrity_check');
  const status = String(integrity.rows[0]?.integrity_check ?? '').toLowerCase();
  const counts = {};

  for (const table of tables) {
    const result = await client.execute(`SELECT COUNT(*) AS count FROM ${table}`);
    counts[table] = Number(result.rows[0].count);
  }

  console.log(JSON.stringify({ file, integrity: status, counts }, null, 2));
  if (status !== 'ok') process.exit(1);
} catch (error) {
  console.error(`Backup verification failed: ${error.message}`);
  process.exit(1);
} finally {
  client.close();
}
