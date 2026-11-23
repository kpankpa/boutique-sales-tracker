import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';

const databaseUrl = process.env.DATABASE_URL || 'file:data/pos.db';

if (!databaseUrl.startsWith('file:')) {
  console.error(
    'A hosted database cannot write a local file.\n' +
    'Use the Turso CLI instead:\n' +
    '  turso db shell <database-name> .dump > backups/pos-<date>.sql'
  );
  process.exit(1);
}

const source = path.resolve(databaseUrl.slice(5).replace(/^\.\//, ''));
if (!fs.existsSync(source)) {
  console.error(`Database not found: ${source}`);
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const destination = path.resolve('backups', `pos-${stamp}.db`);
fs.mkdirSync(path.dirname(destination), { recursive: true });

const client = createClient({ url: `file:${source}` });
try {
  const literal = destination.replace(/'/g, "''");
  await client.execute(`VACUUM INTO '${literal}'`);
} catch (error) {
  console.error(`Backup failed: ${error.message}`);
  process.exit(1);
} finally {
  client.close();
}

console.log(`Backup created: ${destination} (${fs.statSync(destination).size} bytes)`);
