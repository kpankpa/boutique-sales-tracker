// Copy the local SQLite database into the configured Neon PostgreSQL database.
// Run from the project root: npm run migrate:neon
// Credentials come from .env.production.local (or the process environment).
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@libsql/client';
import pg from 'pg';

const root = process.cwd();
const envFile = path.join(root, '.env.production.local');
if (fs.existsSync(envFile)) dotenv.config({ path: envFile, quiet: true });

const targetUrl = process.env.DATABASE_URL;
if (!/^postgres(ql)?:\/\//i.test(targetUrl || '')) {
  console.error('DATABASE_URL must point to PostgreSQL. Set it in .env.production.local.');
  process.exit(1);
}

process.env.DATABASE_URL = targetUrl;
const { createSchema } = await import('../src/models/database.js');

const sourceUrl = process.env.SQLITE_URL || 'file:data/pos.db';
const source = createClient({ url: sourceUrl });

// Parent tables first so foreign keys are satisfied as rows are inserted.
const tables = [
  'settings', 'branches', 'users', 'categories', 'products', 'customers',
  'stock', 'sales', 'sale_lines', 'credit_payments',
  'notification_outbox', 'audit_log', 'login_attempts', 'shop_events'
];
const identityTables = [
  'branches', 'users', 'products', 'customers', 'sales',
  'sale_lines', 'credit_payments', 'notification_outbox', 'audit_log', 'shop_events'
];

const target = new pg.Pool({ connectionString: targetUrl, max: 1 });
const client = await target.connect();

try {
  const setting = await source.execute("SELECT value FROM settings WHERE key = 'installed'");
  if (String(setting.rows[0]?.value || '') !== '1') {
    throw new Error('The local database is not installed. Run /install locally first.');
  }

  await createSchema();
  await client.query('BEGIN');
  await client.query(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`);

  const counts = {};
  for (const table of tables) {
    const info = await source.execute(`PRAGMA table_info(${table})`);
    const columns = info.rows.map((row) => row.name);
    const rows = await source.execute(`SELECT ${columns.map((c) => `"${c}"`).join(', ')} FROM ${table}`);
    const placeholders = (columns) => columns.map((_, index) => `$${index + 1}`).join(', ');
    const quoted = columns.map((c) => `"${c}"`).join(', ');
    const statement = `INSERT INTO "${table}" (${quoted}) VALUES (${placeholders(columns)})`;
    for (const row of rows.rows) {
      await client.query(statement, columns.map((column) => row[column] ?? null));
    }
    counts[table] = rows.rows.length;
  }

  for (const table of identityTables) {
    await client.query(`
      SELECT setval(
        pg_get_serial_sequence('${table}', 'id'),
        GREATEST(COALESCE((SELECT MAX(id) FROM ${table}), 0), 1),
        EXISTS (SELECT 1 FROM ${table})
      )
    `);
  }
  await client.query('COMMIT');

  console.log('Copied rows:');
  for (const table of tables) {
    const result = await client.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
    const migrated = counts[table];
    const actual = result.rows[0].n;
    if (migrated !== actual) throw new Error(`Count mismatch in ${table}: ${migrated} vs ${actual}`);
    console.log(`  ${table.padEnd(20)} ${actual}`);
  }
  console.log('\nSQLite data pushed to Neon successfully.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Migration failed:', error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await target.end();
  source.close();
}
