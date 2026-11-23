import { createClient } from '@libsql/client';

const databaseUrl = process.env.DATABASE_URL || 'file:data/pos.db';
const authToken = process.env.DATABASE_AUTH_TOKEN || undefined;
const days = Math.max(30, Number(process.env.AUDIT_RETENTION_DAYS) || 365);

const client = createClient({ url: databaseUrl, authToken });
try {
  const result = await client.execute({
    sql: "DELETE FROM audit_log WHERE created_at < datetime('now', ?)",
    args: [`-${days} days`]
  });
  console.log(`Removed ${result.rowsAffected} audit entries older than ${days} days.`);
} catch (error) {
  console.error(`Audit prune failed: ${error.message}`);
  process.exit(1);
} finally {
  client.close();
}
