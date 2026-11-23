import { database } from '../database';

export async function insertSale({
  receiptNo,
  branchId,
  userId,
  customerId,
  paymentMethod,
  subtotal,
  discount,
  total,
  clientRef
}, executor = database) {
  const result = await executor.execute({
    sql: `INSERT INTO sales
          (receipt_no, branch_id, user_id, customer_id, payment_method, subtotal, discount, total, client_ref)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [receiptNo, branchId, userId, customerId, paymentMethod, subtotal, discount, total, clientRef]
  });
  return Number(result.lastInsertRowid);
}

export async function findSaleByClientRef(clientRef, executor = database) {
  const result = await executor.execute({
    sql: `SELECT id, receipt_no, total FROM sales WHERE client_ref = ?`,
    args: [clientRef]
  });
  return result.rows[0] ?? null;
}

export async function insertSaleLines(saleId, lines, executor = database) {
  const statements = lines.map((line) => ({
    sql: `INSERT INTO sale_lines
          (sale_id, product_id, sku_snapshot, name_snapshot, size_snapshot, qty, unit_price, line_total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      saleId,
      line.productId,
      line.sku,
      line.name,
      line.size ?? null,
      line.qty,
      line.unitPrice,
      line.lineTotal
    ]
  }));
  await executor.batch(statements, 'write');
}

export async function listSales({ branchId = null, limit = 100 } = {}) {
  const clauses = [];
  const args = [];

  if (branchId) {
    clauses.push('s.branch_id = ?');
    args.push(branchId);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  args.push(limit);

  const result = await database.execute({
    sql: `SELECT s.id, s.receipt_no, s.branch_id, b.name AS branch_name,
                 s.user_id, u.name AS cashier_name, s.customer_id, c.name AS customer_name,
                 s.payment_method, s.subtotal, s.discount, s.total, s.created_at
          FROM sales s
          LEFT JOIN branches b ON b.id = s.branch_id
          LEFT JOIN users u ON u.id = s.user_id
          LEFT JOIN customers c ON c.id = s.customer_id
          ${where}
          ORDER BY s.id DESC
          LIMIT ?`,
    args
  });

  const sales = result.rows;
  await Promise.all(sales.map(async (sale) => {
    const lines = await database.execute({
      sql: `SELECT sku_snapshot, name_snapshot, size_snapshot, qty, unit_price, line_total
            FROM sale_lines WHERE sale_id = ?`,
      args: [sale.id]
    });
    sale.lines = lines.rows;
  }));

  return sales;
}

export async function salesForToday(branchId = null) {
  const clauses = ["date(s.created_at) = date('now')"];
  const args = [];
  if (branchId) {
    clauses.push('s.branch_id = ?');
    args.push(branchId);
  }
  const result = await database.execute({
    sql: `SELECT s.payment_method, b.name AS branch_name,
                 COUNT(*) AS sale_count, COALESCE(SUM(s.total), 0) AS amount
          FROM sales s
          LEFT JOIN branches b ON b.id = s.branch_id
          WHERE ${clauses.join(' AND ')}
          GROUP BY s.branch_id, s.payment_method
          ORDER BY b.name ASC`,
    args
  });
  return result.rows;
}
