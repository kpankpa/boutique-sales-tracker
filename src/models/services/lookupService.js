import { AppError } from '../errors';
import { findProductByBarcode, findProductBySku } from '../repositories/products';

// Resolves a scanned or typed code: manufacturer barcode first, then item code.
export async function lookupCode(rawCode) {
  const code = String(rawCode ?? '').trim().toUpperCase();
  if (!code) throw new AppError('Scan or type a code first.');
  if (code.length > 64) throw new AppError('That code is too long.');

  const product = (await findProductByBarcode(code)) ?? (await findProductBySku(code));
  if (!product) {
    throw new AppError('No item matches that code.', 'CODE_NOT_FOUND');
  }
  return product;
}
