import { database } from '../database';

const columns = 'id, name, username, role, branch_id, active, created_at';

export async function findUserByUsername(username) {
  const result = await database.execute({
    sql: `SELECT id, name, username, password_hash, pin_hash, role, branch_id, active
          FROM users WHERE username = ?`,
    args: [username]
  });
  return result.rows[0] ?? null;
}

export async function findUserById(id) {
  const result = await database.execute({
    sql: `SELECT id, name, username, password_hash, pin_hash, role, branch_id, active
          FROM users WHERE id = ?`,
    args: [id]
  });
  return result.rows[0] ?? null;
}

export async function listUsers() {
  const result = await database.execute(`SELECT ${columns} FROM users ORDER BY id ASC`);
  return result.rows;
}

export async function insertUser({ name, username, passwordHash, role, branchId, pinHash }) {
  const result = await database.execute({
    sql: `INSERT INTO users (name, username, password_hash, pin_hash, role, branch_id)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [name, username, passwordHash, pinHash ?? null, role, branchId ?? null]
  });
  return Number(result.lastInsertRowid);
}

export async function setUserActive(id, active) {
  await database.execute({
    sql: 'UPDATE users SET active = ? WHERE id = ?',
    args: [active ? 1 : 0, id]
  });
}

export async function updateUser({ id, name, username, passwordHash, pinHash, role, branchId, active }) {
  const fields = ['name = ?', 'username = ?', 'role = ?', 'branch_id = ?', 'active = ?'];
  const args = [name, username, role, branchId ?? null, active ? 1 : 0];
  if (passwordHash !== undefined) {
    fields.push('password_hash = ?');
    args.push(passwordHash);
  }
  if (pinHash !== undefined) {
    fields.push('pin_hash = ?');
    args.push(pinHash);
  }
  args.push(id);
  await database.execute({
    sql: `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
    args
  });
}
