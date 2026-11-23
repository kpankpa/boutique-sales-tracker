import { database } from '../database';

export async function listProducts() {
  const result = await database.execute(
    `SELECT id, sku, name, category, size, price, cost, active
     FROM products
     ORDER BY name ASC, category ASC, size ASC, sku ASC`
  );
  return result.rows;
}

export async function findProductBySku(sku) {
  const result = await database.execute({
    sql: `SELECT id, sku, name, category, size, price, cost
          FROM products
          WHERE sku = ? AND active = 1`,
    args: [sku]
  });
  return result.rows[0] ?? null;
}

export async function findProductById(id) {
  const result = await database.execute({
    sql: 'SELECT id, sku, name, category, size, price, cost FROM products WHERE id = ?',
    args: [id]
  });
  return result.rows[0] ?? null;
}

export async function insertProduct({ sku, name, category = 'other', size = null, price, cost }) {
  const result = await database.execute({
    sql: `INSERT INTO products (sku, name, category, size, price, cost)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [sku, name, category, size, price, cost]
  });
  return Number(result.lastInsertRowid);
}

export async function updateProduct({ id, name, category, size, price, cost, active }) {
  await database.execute({
    sql: `UPDATE products
          SET name = ?, category = ?, size = ?, price = ?, cost = ?, active = ?
          WHERE id = ?`,
    args: [name, category, size, price, cost, active ? 1 : 0, id]
  });
}
