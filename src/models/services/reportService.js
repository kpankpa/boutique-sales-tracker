import { listLowStock } from '../repositories/activity';
import { salesForToday } from '../repositories/sales';

const paymentKeys = ['cash', 'momo', 'card', 'credit'];

export async function dailySummary(branchId = null) {
  const rows = await salesForToday(branchId);
  const branches = new Map();

  for (const row of rows) {
    if (!branches.has(row.branch_name)) {
      branches.set(row.branch_name, {
        name: row.branch_name,
        saleCount: 0,
        amount: 0,
        methods: Object.fromEntries(paymentKeys.map((key) => [key, 0]))
      });
    }
    const branch = branches.get(row.branch_name);
    branch.saleCount += Number(row.sale_count);
    branch.amount += Number(row.amount);
    branch.methods[row.payment_method] = Number(row.amount);
  }

  const list = [...branches.values()].map((branch) => ({
    ...branch,
    amount: Number(branch.amount.toFixed(2))
  }));

  return {
    branches: list,
    totalSales: list.reduce((sum, branch) => sum + branch.saleCount, 0),
    totalAmount: Number(list.reduce((sum, branch) => sum + branch.amount, 0).toFixed(2))
  };
}

export async function lowStock() {
  return listLowStock();
}
