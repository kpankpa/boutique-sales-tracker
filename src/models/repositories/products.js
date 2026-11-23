import { database } from '../database';

const columns = 'id, sku, name, category, size, barcode, image_url, price, cost, active';

export async function listProducts() {
  const result = await database.execute(
    `SELECT ${columns}
     FROM products
     ORDER BY name ASC, category ASC, size ASC, sku ASC`
  );
  return result.rows;
}

export async function findProductBySku(sku) {
  const result = await database.execute({
    sql: `SELECT id, sku, name, category, size, barcode, image_url, price, cost
          FROM products
          WHERE sku = ? AND active = 1`,
    args: [sku]
  });
  return result.rows[0] ?? null;
}

export async function findProductByBarcode(barcode) {
  const result = await database.execute({
    sql: `SELECT id, sku, name, category, size, barcode, image_url, price, cost
          FROM products
          WHERE barcode = ? AND active = 1`,
    args: [barcode]
  });
  return result.rows[0] ?? null;
}

export async function findProductById(id) {
  const result = await database.execute({
    sql: `SELECT ${columns} FROM products WHERE id = ?`,
    args: [id]
  });
  return result.rows[0] ?? null;
}

export async function insertProduct({ sku, name, category = 'other', size = null, barcode = null, imageUrl = null, price, cost }) {
  const result = await database.execute({
    sql: `INSERT INTO products (sku, name, category, size, barcode, image_url, price, cost)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [sku, name, category, size, barcode, imageUrl, price, cost]
  });
  return Number(result.lastInsertRowid);
}

export async function updateProduct({ id, name, category, size, barcode, imageUrl, price, cost, active }) {
  await database.execute({
    sql: `UPDATE products
          SET name = ?, category = ?, size = ?, barcode = ?, image_url = ?, price = ?, cost = ?, active = ?
          WHERE id = ?`,
    args: [name, category, size, barcode, imageUrl, price, cost, active ? 1 : 0, id]
  });
}
