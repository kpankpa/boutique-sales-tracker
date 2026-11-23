import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';

const databaseUrl = process.env.DATABASE_URL || 'file:data/pos.db';
const authToken = process.env.DATABASE_AUTH_TOKEN || undefined;

if (databaseUrl.startsWith('file:')) {
  const filePath = databaseUrl.slice(5).replace(/^\.\//, '');
  const directory = path.dirname(filePath);
  if (directory && directory !== '.' && !fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

export const database = createClient({ url: databaseUrl, authToken });

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

export async function createSchema() {
  for (const statement of schema) {
    await database.execute(statement);
  }

  // Databases created before client references were added need the column.
  try {
    await database.execute('ALTER TABLE sales ADD COLUMN client_ref TEXT');
  } catch (error) {
    if (!String(error.message).includes('duplicate column')) throw error;
  }

  await database.execute(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_client_ref ON sales(client_ref)'
  );

  for (const statement of [
    "ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT 'other'",
    'ALTER TABLE products ADD COLUMN size TEXT',
    'ALTER TABLE sale_lines ADD COLUMN size_snapshot TEXT'
  ]) {
    try {
      await database.execute(statement);
    } catch (error) {
      if (!String(error.message).includes('duplicate column')) throw error;
    }
  }

  const defaultCategories = [
    ['shoes', 'Shoes', 'Shoe size', JSON.stringify(['38', '39', '40', '41', '42', '43', '44', '45', '46'])],
    ['clothing', 'Dresses / shirts', 'Clothing size', JSON.stringify(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free size'])],
    ['trousers', 'Trousers / shorts', 'Waist size', JSON.stringify(['28', '30', '32', '34', '36', '38', '40', '42'])],
    ['accessories', 'Accessories / no size', 'Size', '[]'],
    ['other', 'Other', 'Size', '[]']
  ];
  for (const [id, name, sizeLabel, sizesJson] of defaultCategories) {
    await database.execute({
      sql: `INSERT OR IGNORE INTO categories (id, name, size_label, sizes_json)
            VALUES (?, ?, ?, ?)`,
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
