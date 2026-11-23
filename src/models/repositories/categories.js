import { database } from '../database';

function mapCategory(row) {
  let sizes = [];
  try {
    sizes = JSON.parse(row.sizes_json || '[]');
  } catch {
    sizes = [];
  }
  return {
    id: row.id,
    name: row.name,
    sizeLabel: row.size_label,
    sizes: Array.isArray(sizes) ? sizes : [],
    active: Number(row.active)
  };
}

export async function listCategories() {
  const result = await database.execute(
    `SELECT id, name, size_label, sizes_json, active
     FROM categories
     ORDER BY active DESC, name ASC`
  );
  return result.rows.map(mapCategory);
}

export async function findCategoryById(id) {
  const result = await database.execute({
    sql: `SELECT id, name, size_label, sizes_json, active
          FROM categories WHERE id = ?`,
    args: [id]
  });
  return result.rows[0] ? mapCategory(result.rows[0]) : null;
}

export async function insertCategory({ id, name, sizeLabel, sizes }) {
  await database.execute({
    sql: `INSERT INTO categories (id, name, size_label, sizes_json)
          VALUES (?, ?, ?, ?)`,
    args: [id, name, sizeLabel, JSON.stringify(sizes)]
  });
  return id;
}

export async function updateCategory({ id, name, sizeLabel, sizes, active }) {
  await database.execute({
    sql: `UPDATE categories
          SET name = ?, size_label = ?, sizes_json = ?, active = ?
          WHERE id = ?`,
    args: [name, sizeLabel, JSON.stringify(sizes), active ? 1 : 0, id]
  });
}
