import crypto from 'node:crypto';
import { AppError } from '../errors';
import { withTransaction } from '../database';
import { addAudit, addOutboxEvent, adjustStock, getStockQty } from '../repositories/activity';
import { findProductBySku } from '../repositories/products';
import { findSaleByClientRef, insertSale, insertSaleLines } from '../repositories/sales';
import { findCustomerById } from '../repositories/customers';
import { displayProductName } from '../productOptions';
import { nonNegativeNumber, positiveNumber, requireOneOf, required } from '../validation';

const paymentMethods = ['cash', 'momo', 'card', 'credit'];

function makeReceiptNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = Math.floor(Math.random() * 90 + 10);
  return `R-${stamp}-${suffix}`;
}

function clientReference(input) {
  if (input.clientRef === undefined || input.clientRef === null || input.clientRef === '') {
    return crypto.randomUUID();
  }
  const reference = String(input.clientRef).trim();
  if (reference.length > 100) throw new AppError('Sale reference is too long.');
  return reference;
}

function buildLines(items) {
  return items.map((item) => {
    const qty = positiveNumber(item.qty, 'Quantity');
    const product = item.product;
    return {
      productId: product.id,
      sku: product.sku,
      name: displayProductName(product.name, product.size),
      size: product.size ?? null,
      qty,
      unitPrice: product.price,
      lineTotal: Number((product.price * qty).toFixed(2))
    };
  });
}

function isDuplicateReference(error) {
  return String(error.message).includes('sales.client_ref');
}

export async function recordSale(user, input) {
  const branchId = user.branchId ?? input.branchId ?? null;
  if (!branchId) {
    throw new AppError('Choose a branch before recording a sale.');
  }

  const clientRef = clientReference(input);
  const existing = await findSaleByClientRef(clientRef);
  if (existing) {
    return {
      saleId: existing.id,
      receiptNo: existing.receipt_no,
      total: existing.total,
      replayed: true
    };
  }

  const paymentMethod = requireOneOf(input.paymentMethod, paymentMethods, 'Payment method');
  const items = Array.isArray(input.items) ? input.items : [];
  if (items.length === 0) {
    throw new AppError('Add at least one item to the sale.');
  }

  const resolvedItems = await Promise.all(items.map(async (item) => ({
    qty: item.qty,
    product: await findProductBySku(required(item.sku, 'Item code'))
  })));

  const missing = resolvedItems.find((item) => !item.product);
  if (missing) {
    throw new AppError('One of the item codes is not in the catalogue.');
  }

  const lines = buildLines(resolvedItems);
  const subtotal = Number(lines.reduce((sum, line) => sum + line.lineTotal, 0).toFixed(2));
  const discount = nonNegativeNumber(input.discount, 'Discount');
  if (discount > subtotal) {
    throw new AppError('Discount cannot be more than the sale total.');
  }

  if (input.customerId) {
    const customer = await findCustomerById(input.customerId);
    if (!customer) throw new AppError('Selected customer was not found.');
  }

  const total = Number((subtotal - discount).toFixed(2));
  const receiptNo = makeReceiptNumber();

  try {
    return await withTransaction(async (tx) => {
      const stock = new Map();
      for (const line of lines) {
        const qty = await getStockQty(branchId, line.productId, tx);
        if (qty !== null && qty < line.qty) {
          throw new AppError(
            `Not enough stock for ${line.name}. Only ${qty} left.`,
            'INSUFFICIENT_STOCK',
            { sku: line.sku, name: line.name, requested: line.qty, available: qty }
          );
        }
        stock.set(line.productId, qty);
      }

      const saleId = await insertSale({
        receiptNo,
        branchId,
        userId: user.id,
        customerId: input.customerId ?? null,
        paymentMethod,
        subtotal,
        discount,
        total,
        clientRef
      }, tx);

      await insertSaleLines(saleId, lines, tx);

      for (const line of lines) {
        if (stock.get(line.productId) !== null) {
          await adjustStock(branchId, line.productId, -line.qty, tx);
        }
      }

      await addOutboxEvent('sale_created', saleId, {
        receiptNo,
        branchId,
        cashier: user.name,
        paymentMethod,
        total,
        lines: lines.map((line) => ({ sku: line.sku, size: line.size, qty: line.qty }))
      }, tx);

      await addAudit(user.id, 'sale_created', 'sale', saleId, { receiptNo, total }, tx);

      return { saleId, receiptNo, total };
    });
  } catch (error) {
    if (!isDuplicateReference(error)) throw error;
    const replayed = await findSaleByClientRef(clientRef);
    if (!replayed) throw error;
    return {
      saleId: replayed.id,
      receiptNo: replayed.receipt_no,
      total: replayed.total,
      replayed: true
    };
  }
}
