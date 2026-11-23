import { database } from '../database';

export async function listBranches() {
  const result = await database.execute(
    'SELECT id, name, code, active FROM branches ORDER BY id ASC'
  );
  return result.rows;
}

export async function findBranchByCode(code) {
  const result = await database.execute({
    sql: 'SELECT id, name, code FROM branches WHERE code = ?',
    args: [code]
  });
  return result.rows[0] ?? null;
}

export async function insertBranch(name, code) {
  const result = await database.execute({
    sql: 'INSERT INTO branches (name, code) VALUES (?, ?)',
    args: [name, code]
  });
  return Number(result.lastInsertRowid);
}

export async function updateBranch({ id, name, code, active }) {
  await database.execute({
    sql: 'UPDATE branches SET name = ?, code = ?, active = ? WHERE id = ?',
    args: [name, code, active ? 1 : 0, id]
  });
}
