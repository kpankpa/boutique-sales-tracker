import { database } from '../database';

export async function listCustomers(search = '') {
  const term = `%${search.trim()}%`;
  const result = await database.execute({
    sql: `SELECT id, name, phone, email, tags, notes, credit_limit, consent_at, active, created_at
          FROM customers
          WHERE name LIKE ? OR COALESCE(phone, '') LIKE ?
          ORDER BY id DESC`,
    args: [term, term]
  });
  return result.rows;
}

export async function findCustomerById(id) {
  const result = await database.execute({
    sql: 'SELECT id, name, phone, credit_limit FROM customers WHERE id = ?',
    args: [id]
  });
  return result.rows[0] ?? null;
}

export async function findCustomerByPhone(phone) {
  const result = await database.execute({
    sql: 'SELECT id, name, phone FROM customers WHERE phone = ?',
    args: [phone]
  });
  return result.rows[0] ?? null;
}

export async function exportCustomers() {
  const result = await database.execute(
    `SELECT id, name, phone, email, tags, notes, credit_limit, consent_at, active, created_at
     FROM customers ORDER BY id ASC`
  );
  return result.rows;
}

export async function setCustomerInactive(id, executor = database) {
  await executor.execute({
    sql: 'UPDATE customers SET active = 0 WHERE id = ?',
    args: [id]
  });
}

export async function updateCustomer({ id, name, phone, email, tags, notes, creditLimit, active }) {
  await database.execute({
    sql: `UPDATE customers
          SET name = ?, phone = ?, email = ?, tags = ?, notes = ?, credit_limit = ?, active = ?
          WHERE id = ?`,
    args: [name, phone ?? null, email ?? null, tags ?? null, notes ?? null, creditLimit ?? 0, active ? 1 : 0, id]
  });
}

export async function insertCustomer({ name, phone, email, tags, notes, consentAt, creditLimit }) {
  const result = await database.execute({
    sql: `INSERT INTO customers (name, phone, email, tags, notes, consent_at, credit_limit)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [name, phone ?? null, email ?? null, tags ?? null, notes ?? null, consentAt ?? null, creditLimit ?? 0]
  });
  return Number(result.lastInsertRowid);
}
