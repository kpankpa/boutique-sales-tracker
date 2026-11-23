import { createClient } from '@libsql/client';
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';

const databaseUrl = process.env.DATABASE_URL || 'file:data/pos.db';
const authToken = process.env.DATABASE_AUTH_TOKEN || undefined;

// PostgreSQL (e.g. Neon) for hosted deployments; libSQL/SQLite for local files.
export const isPostgres = /^postgres(ql)?:\/\//i.test(databaseUrl);
export const dialect = isPostgres ? 'postgres' : 'sqlite';

if (!isPostgres && databaseUrl.startsWith('file:')) {
  const filePath = databaseUrl.slice(5).replace(/^\.\//, '');
  const directory = path.dirname(filePath);
  if (directory && directory !== '.' && !fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

// --- PostgreSQL adapter -----------------------------------------------------
// Emulates the libSQL executor interface ({ rows, lastInsertRowid }, batch)
// so repositories can stay dialect-agnostic.

function convertPlaceholders(sql) {
  let index = 0;
  let inString = false;
  let out = '';
  for (const ch of sql) {
    if (ch === "'") {
      inString = !inString;
      out += ch;
    } else if (ch === '?' && !inString) {
      index += 1;
      out += `$${index}`;
    } else {
      out += ch;
    }
  }
  return out;
}

function formatUtc(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function normalizeRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    // Match SQLite's CURRENT_TIMESTAMP text format so dates behave the same.
    out[key] = value instanceof Date ? formatUtc(value) : value;
  }
  return out;
}

function prepareSql(sql) {
  let text = convertPlaceholders(sql);
  if (/^\s*INSERT\b/i.test(text) && !/\bRETURNING\b/i.test(text)) {
    text += ' RETURNING *';
  }
  return text;
}

function makePgExecutor(queryable, pool) {
  const executor = {
    async execute(statement) {
      const { sql, args = [] } = typeof statement === 'string' ? { sql: statement } : statement;
      const result = await queryable.query(prepareSql(sql), args);
      const rows = result.rows.map(normalizeRow);
      return {
        rows,
        rowsAffected: result.rowCount ?? 0,
        lastInsertRowid: rows[0]?.id ?? null
      };
    },
    async batch(statements) {
      if (queryable === pool) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const results = [];
          for (const statement of statements) {
            results.push(await makePgExecutor(client, pool).execute(statement));
          }
          await client.query('COMMIT');
          return results;
        } catch (error) {
          await client.query('ROLLBACK').catch(() => {});
          throw error;
        } finally {
          client.release();
        }
      }
      const results = [];
      for (const statement of statements) {
        results.push(await executor.execute(statement));
      }
      return results;
    }
  };
  return executor;
}

let pool = null;
let database;

if (isPostgres) {
  // COUNT(*) and other int8 results arrive as strings by default; ids/counts
  // here are always small enough to be safe numbers.
  pg.types.setTypeParser(20, (value) => Number(value));
  pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000
  });
  database = makePgExecutor(pool, pool);
} else {
  database = createClient({ url: databaseUrl, authToken });
}

export { database };

// --- Dialect helpers --------------------------------------------------------

export function likeOperator() {
  return isPostgres ? 'ILIKE' : 'LIKE';
}

export function todayClause(column) {
  return isPostgres
    ? `(${column} AT TIME ZONE 'UTC')::date = (NOW() AT TIME ZONE 'UTC')::date`
    : `date(${column}) = date('now')`;
}

export function olderThanOneDayClause(column) {
  return isPostgres
    ? `${column} < NOW() - INTERVAL '1 day'`
    : `${column} < datetime('now', '-1 day')`;
}

export function insertIgnoreSql(table, columns, placeholders, conflictTarget) {
  return isPostgres
    ? `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) ON CONFLICT (${conflictTarget}) DO NOTHING`
    : `INSERT OR IGNORE INTO ${table} (${columns}) VALUES (${placeholders})`;
}

function isDuplicateColumn(error) {
  return String(error.message).includes('duplicate column') || error.code === '42701';
}

// --- Schema -----------------------------------------------------------------

const schema = [
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    active INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'cashier')),
    branch_id INTEGER,
    pin_hash TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES branches(id)
  )`,
  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    size_label TEXT NOT NULL DEFAULT 'Size',
    sizes_json TEXT NOT NULL DEFAULT '[]',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    size TEXT,
    barcode TEXT,
    image_url TEXT,
    price REAL NOT NULL,
    cost REAL NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS stock (
    branch_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    qty REAL NOT NULL DEFAULT 0,
    low_at REAL NOT NULL DEFAULT 5,
    PRIMARY KEY (branch_id, product_id),
    FOREIGN KEY (branch_id) REFERENCES branches(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  )`,
  `CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    tags TEXT,
    notes TEXT,
    consent_at TEXT,
    credit_limit REAL NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_no TEXT NOT NULL UNIQUE,
    branch_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    customer_id INTEGER,
    payment_method TEXT NOT NULL,
    subtotal REAL NOT NULL,
    discount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    client_ref TEXT,
    FOREIGN KEY (branch_id) REFERENCES branches(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`,
  `CREATE TABLE IF NOT EXISTS sale_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    sku_snapshot TEXT NOT NULL,
    name_snapshot TEXT NOT NULL,
    size_snapshot TEXT,
    qty REAL NOT NULL,
    unit_price REAL NOT NULL,
    line_total REAL NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  )`,
  `CREATE TABLE IF NOT EXISTS credit_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    sale_id INTEGER,
    amount REAL NOT NULL,
    paid_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (sale_id) REFERENCES sales(id)
  )`,
  `CREATE TABLE IF NOT EXISTS notification_outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    entity_id INTEGER,
    payload TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    entity TEXT,
    entity_id INTEGER,
    meta TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS login_attempts (
    key TEXT PRIMARY KEY,
    failures INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sales_branch_date ON sales(branch_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sale_lines_sale ON sale_lines(sale_id)`,
  `CREATE INDEX IF NOT EXISTS idx_outbox_status ON notification_outbox(status)`
];

function toPostgresDdl(statement) {
  return statement
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY')
    .replace(/\bREAL\b/g, 'DOUBLE PRECISION')
    .replace(/TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP/g, 'TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP');
}

export async function createSchema() {
  for (const statement of schema) {
    await database.execute(isPostgres ? toPostgresDdl(statement) : statement);
  }

  // Databases created before client references were added need the column.
  try {
    await database.execute('ALTER TABLE sales ADD COLUMN client_ref TEXT');
  } catch (error) {
    if (!isDuplicateColumn(error)) throw error;
  }

  await database.execute(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_client_ref ON sales(client_ref)'
  );

  for (const statement of [
    "ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT 'other'",
    'ALTER TABLE products ADD COLUMN size TEXT',
    'ALTER TABLE products ADD COLUMN barcode TEXT',
    'ALTER TABLE products ADD COLUMN image_url TEXT',
    'ALTER TABLE sale_lines ADD COLUMN size_snapshot TEXT'
  ]) {
    try {
      await database.execute(statement);
    } catch (error) {
      if (!isDuplicateColumn(error)) throw error;
    }
  }

  // One barcode per item; items without a barcode are unconstrained.
  await database.execute(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL'
  );

  const defaultCategories = [
    ['shoes', 'Shoes', 'Shoe size', JSON.stringify(['38', '39', '40', '41', '42', '43', '44', '45', '46'])],
    ['clothing', 'Dresses / shirts', 'Clothing size', JSON.stringify(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free size'])],
    ['trousers', 'Trousers / shorts', 'Waist size', JSON.stringify(['28', '30', '32', '34', '36', '38', '40', '42'])],
    ['accessories', 'Accessories / no size', 'Size', '[]'],
    ['other', 'Other', 'Size', '[]']
  ];
  for (const [id, name, sizeLabel, sizesJson] of defaultCategories) {
    await database.execute({
      sql: insertIgnoreSql('categories', 'id, name, size_label, sizes_json', '?, ?, ?, ?', 'id'),
      args: [id, name, sizeLabel, sizesJson]
    });
  }
}

let schemaReady;

export function ensureSchema() {
  if (!schemaReady) {
    schemaReady = createSchema().catch((error) => {
      schemaReady = undefined;
      throw error;
    });
  }
  return schemaReady;
}

export async function withTransaction(work) {
  if (isPostgres) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(makePgExecutor(client, pool));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  const transaction = await database.transaction('write');
  try {
    const result = await work(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  } finally {
    transaction.close();
  }
}
