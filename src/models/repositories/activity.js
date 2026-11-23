import { database } from '../database';

export async function getStockQty(branchId, productId, executor = database) {
  const result = await executor.execute({
    sql: 'SELECT qty FROM stock WHERE branch_id = ? AND product_id = ?',
    args: [branchId, productId]
  });
  return result.rows[0] ? Number(result.rows[0].qty) : null;
}

export async function adjustStock(branchId, productId, quantityChange, executor = database) {
  await executor.execute({
    sql: `INSERT INTO stock (branch_id, product_id, qty) VALUES (?, ?, ?)
          ON CONFLICT(branch_id, product_id) DO UPDATE SET qty = stock.qty + excluded.qty`,
    args: [branchId, productId, quantityChange]
  });
}

export async function listStock({ limit = 200, branchId = null } = {}) {
  const where = branchId ? 'WHERE s.branch_id = ?' : '';
  const args = branchId ? [branchId, limit] : [limit];
  const result = await database.execute({
    sql: `SELECT b.id AS branch_id, b.name AS branch_name,
                 p.id AS product_id, p.sku, p.name AS product_name, p.category, p.size,
                 s.qty, s.low_at
          FROM stock s
          JOIN branches b ON b.id = s.branch_id
          JOIN products p ON p.id = s.product_id
          ${where}
          ORDER BY b.name ASC, p.name ASC, p.size ASC, p.sku ASC
          LIMIT ?`,
    args
  });
  return result.rows;
}

export async function listLowStock(limit = 20) {
  const result = await database.execute({
    sql: `SELECT b.name AS branch_name, p.sku, p.name, p.category, p.size, s.qty, s.low_at
          FROM stock s
          JOIN products p ON p.id = s.product_id
          JOIN branches b ON b.id = s.branch_id
          WHERE s.qty <= s.low_at
          ORDER BY s.qty ASC
          LIMIT ?`,
    args: [limit]
  });
  return result.rows;
}

export async function addOutboxEvent(eventType, entityId, payload, executor = database) {
  await executor.execute({
    sql: `INSERT INTO notification_outbox (event_type, entity_id, payload)
          VALUES (?, ?, ?)`,
    args: [eventType, entityId, JSON.stringify(payload)]
  });
}

export async function listOutboxEvents(limit = 50) {
  const result = await database.execute({
    sql: `SELECT id, event_type, entity_id, payload, status, created_at, sent_at
          FROM notification_outbox
          ORDER BY id DESC
          LIMIT ?`,
    args: [limit]
  });
  return result.rows.map((row) => ({
    ...row,
    payload: row.payload ? JSON.parse(row.payload) : null
  }));
}

export async function addAudit(userId, action, entity, entityId, meta, executor = database) {
  await executor.execute({
    sql: `INSERT INTO audit_log (user_id, action, entity, entity_id, meta)
          VALUES (?, ?, ?, ?, ?)`,
    args: [userId, action, entity, entityId, meta ? JSON.stringify(meta) : null]
  });
}

export async function listAudit(limit = 50) {
  const result = await database.execute({
    sql: `SELECT a.id, a.action, a.entity, a.entity_id, a.meta, a.created_at, u.name AS user_name
          FROM audit_log a
          LEFT JOIN users u ON u.id = a.user_id
          ORDER BY a.id DESC
          LIMIT ?`,
    args: [limit]
  });
  return result.rows.map((row) => ({
    ...row,
    meta: row.meta ? JSON.parse(row.meta) : null
  }));
}

export async function addCreditPayment(customerId, saleId, amount) {
  await database.execute({
    sql: 'INSERT INTO credit_payments (customer_id, sale_id, amount) VALUES (?, ?, ?)',
    args: [customerId, saleId, amount]
  });
}
