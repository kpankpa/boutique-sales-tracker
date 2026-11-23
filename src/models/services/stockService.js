import { withTransaction } from '../database';
import { AppError } from '../errors';
import { addAudit, adjustStock, getStockQty } from '../repositories/activity';
import { findProductBySku } from '../repositories/products';
import { required } from '../validation';

function assertBranchAccess(user, branchId) {
  if (user.role === 'cashier' && user.branchId && Number(user.branchId) !== branchId) {
    throw new AppError('You can only adjust stock in your own branch.', 'BRANCH_DENIED');
  }
}

export async function adjustStockFromInput(user, input) {
  const branchId = Number(input.branchId);
  if (!branchId) throw new AppError('Choose a branch.');
  assertBranchAccess(user, branchId);

  const sku = required(input.sku, 'Item code').toUpperCase();
  const product = await findProductBySku(sku);
  if (!product) throw new AppError('That item code is not in the catalogue.');

  const delta = Number(input.delta);
  if (!Number.isFinite(delta) || delta === 0) {
    throw new AppError('Enter a non-zero quantity change.');
  }
  if (user.role === 'cashier' && delta < 0) {
    throw new AppError('Only an admin can reduce stock.', 'ADMIN_REQUIRED');
  }

  return withTransaction(async (tx) => {
    const current = (await getStockQty(branchId, product.id, tx)) ?? 0;
    const next = current + delta;
    if (next < 0) {
      throw new AppError(
        'Stock cannot be negative.',
        'INSUFFICIENT_STOCK',
        { sku: product.sku, requested: -delta, available: current }
      );
    }

    await adjustStock(branchId, product.id, delta, tx);
    await addAudit(
      user.id,
      'stock_adjusted',
      'stock',
      product.id,
      { branchId, sku: product.sku, delta, qty: next },
      tx
    );

    return { branchId, productId: product.id, sku: product.sku, qty: next };
  });
}
