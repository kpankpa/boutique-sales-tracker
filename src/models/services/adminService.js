import crypto from 'node:crypto';
import { AppError } from '../errors';
import { withTransaction } from '../database';
import { hashPassword } from '../security';
import { findBranchByCode, insertBranch, listBranches, updateBranch } from '../repositories/branches';
import { findCategoryById, insertCategory, updateCategory } from '../repositories/categories';
import { addAudit, adjustStock } from '../repositories/activity';
import { findCustomerByPhone, insertCustomer, setCustomerInactive, updateCustomer } from '../repositories/customers';
import { findProductByBarcode, findProductById, findProductBySku, insertProduct, updateProduct } from '../repositories/products';
import { findUserById, findUserByUsername, insertUser, updateUser } from '../repositories/users';
import { normalizeCategory, normalizeSize, sizeToken } from '../productOptions';
import {
  nonNegativeNumber,
  normalizeBarcode,
  normalizeCode,
  positiveNumber,
  requireOneOf,
  required
} from '../validation';

export async function createBranch(input) {
  const name = required(input.name, 'Branch name');
  const code = normalizeCode(input.code || name);
  if (await findBranchByCode(code)) {
    throw new AppError('That branch code is already used.');
  }
  return insertBranch(name, code);
}

export async function editBranch(input) {
  const id = Number(input.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError('Choose a branch.');
  const name = required(input.name, 'Branch name');
  const code = normalizeCode(input.code || name);
  const existing = await findBranchByCode(code);
  if (existing && Number(existing.id) !== id) {
    throw new AppError('That branch code is already used.');
  }
  await updateBranch({ id, name, code, active: input.active !== false && input.active !== 0 });
  return { id };
}

function normalizeCategorySizes(input) {
  return Array.isArray(input.sizes)
    ? [...new Set(input.sizes.map((value) => String(value).trim()).filter(Boolean))]
    : String(input.sizes || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .filter((value, index, list) => list.indexOf(value) === index);
}

export async function createCategory(input) {
  const name = required(input.name, 'Category name');
  const id = normalizeCategory(input.id || name);
  if (await findCategoryById(id)) {
    throw new AppError('That category already exists.');
  }
  const sizeLabel = String(input.sizeLabel || 'Size').trim() || 'Size';
  const sizes = normalizeCategorySizes(input);
  await insertCategory({ id, name, sizeLabel, sizes });
  return { id, name, sizeLabel, sizes };
}

export async function editCategory(input) {
  const id = normalizeCategory(input.id);
  const existing = await findCategoryById(id);
  if (!existing) throw new AppError('Choose a category.');
  const name = required(input.name, 'Category name');
  const sizeLabel = String(input.sizeLabel || 'Size').trim() || 'Size';
  const sizes = normalizeCategorySizes(input);
  const active = input.active !== false && input.active !== 0;
  await updateCategory({ id, name, sizeLabel, sizes, active });
  return { id };
}

function normalizeSizes(input) {
  const raw = Array.isArray(input.sizes) ? input.sizes : input.size ? [input.size] : [];
  const sizes = [];
  for (const value of raw) {
    const size = normalizeSize(value);
    if (size && !sizes.includes(size)) sizes.push(size);
  }
  return sizes;
}

function isDuplicateBarcode(error) {
  const message = String(error.message);
  return message.includes('products.barcode') || message.includes('idx_products_barcode');
}

async function assertBarcodeFree(barcode, excludeId = null) {
  if (!barcode) return;
  const existing = await findProductByBarcode(barcode);
  if (existing && Number(existing.id) !== Number(excludeId)) {
    throw new AppError(`That barcode is already used by ${existing.sku}.`, 'BARCODE_EXISTS');
  }
}

async function createVariant({ sku, name, category, size, barcode = null, price, cost, openingStock, branches }) {
  if (await findProductBySku(sku)) {
    throw new AppError(`That item code already exists: ${sku}.`);
  }
  await assertBarcodeFree(barcode);
  let productId;
  try {
    productId = await insertProduct({ sku, name, category, size, barcode, price, cost });
  } catch (error) {
    if (isDuplicateBarcode(error)) {
      throw new AppError('That barcode is already used by another item.', 'BARCODE_EXISTS');
    }
    throw error;
  }
  if (openingStock > 0) {
    for (const branch of branches) {
      if (branch.active) await adjustStock(branch.id, productId, openingStock);
    }
  }
  return productId;
}

export async function createProduct(input) {
  const name = required(input.name, 'Product name');
  const category = normalizeCategory(input.category);
  const price = positiveNumber(input.price, 'Price');
  const cost = nonNegativeNumber(input.cost, 'Cost');
  const openingStock = nonNegativeNumber(input.openingStock, 'Opening stock');
  const sizes = normalizeSizes(input);
  const branches = openingStock > 0 ? await listBranches() : [];
  const multiSize = Array.isArray(input.sizes);

  if (multiSize) {
    const baseSku = normalizeCode(input.baseSku || input.sku || name);
    const variants = sizes.length > 0 ? sizes : [null];
    const ids = [];
    for (const size of variants) {
      const token = size ? sizeToken(size) : 'STD';
      const sku = variants.length === 1 && !size
        ? baseSku
        : normalizeCode(`${baseSku}-${token}`);
      ids.push(await createVariant({ sku, name, category, size, price, cost, openingStock, branches }));
    }
    return { ids, count: ids.length };
  }

  const sku = normalizeCode(input.sku);
  const size = normalizeSize(input.size);
  const barcode = normalizeBarcode(input.barcode);
  const id = await createVariant({ sku, name, category, size, barcode, price, cost, openingStock, branches });
  return { id, ids: [id], count: 1 };
}

export async function editProduct(input) {
  const id = Number(input.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError('Choose a product.');
  const existing = await findProductById(id);
  if (!existing) throw new AppError('Choose a product.');
  const name = required(input.name, 'Product name');
  const category = normalizeCategory(input.category);
  const size = normalizeSize(input.size);
  const price = positiveNumber(input.price, 'Price');
  const cost = nonNegativeNumber(input.cost, 'Cost');
  const active = input.active !== false && input.active !== 0;
  // Omitted barcode keeps the current one (quick actions only toggle status).
  const barcode = input.barcode === undefined
    ? existing.barcode ?? null
    : normalizeBarcode(input.barcode);
  await assertBarcodeFree(barcode, id);
  try {
    await updateProduct({ id, name, category, size, barcode, price, cost, active });
  } catch (error) {
    if (isDuplicateBarcode(error)) {
      throw new AppError('That barcode is already used by another item.', 'BARCODE_EXISTS');
    }
    throw error;
  }
  return { id };
}

export async function createCustomer(input) {
  const name = required(input.name, 'Customer name');
  const phone = input.phone ? String(input.phone).trim() : null;

  if (phone && (await findCustomerByPhone(phone))) {
    throw new AppError('A customer with that phone number already exists.');
  }

  return insertCustomer({
    name,
    phone,
    email: input.email ? String(input.email).trim() : null,
    tags: input.tags ? String(input.tags).trim() : null,
    notes: input.notes ? String(input.notes).trim() : null,
    consentAt: input.consent ? new Date().toISOString() : null,
    creditLimit: nonNegativeNumber(input.creditLimit, 'Credit limit')
  });
}

export async function deactivateCustomer(user, input) {
  const id = Number(input.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError('Choose a customer.');

  await withTransaction(async (tx) => {
    await setCustomerInactive(id, tx);
    await addAudit(user.id, 'customer_deactivated', 'customer', id, null, tx);
  });
  return { id };
}

export async function editCustomer(input) {
  const id = Number(input.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError('Choose a customer.');
  const name = required(input.name, 'Customer name');
  const phone = input.phone ? String(input.phone).trim() : null;
  if (phone) {
    const existing = await findCustomerByPhone(phone);
    if (existing && Number(existing.id) !== id) {
      throw new AppError('A customer with that phone number already exists.');
    }
  }
  await updateCustomer({
    id,
    name,
    phone,
    email: input.email ? String(input.email).trim() : null,
    tags: input.tags ? String(input.tags).trim() : null,
    notes: input.notes ? String(input.notes).trim() : null,
    creditLimit: nonNegativeNumber(input.creditLimit, 'Credit limit'),
    active: input.active !== false && input.active !== 0
  });
  return { id };
}

export async function createUser(input) {
  const name = required(input.name, 'Staff name');
  const username = required(input.username, 'Username').toLowerCase();
  const role = requireOneOf(input.role, ['admin', 'cashier'], 'Role');

  if (await findUserByUsername(username)) {
    throw new AppError('That username is already taken.');
  }

  const branchId = role === 'cashier' ? Number(input.branchId) : null;
  if (role === 'cashier' && !branchId) {
    throw new AppError('Choose a branch for the cashier.');
  }

  let passwordHash = null;
  let pinHash = null;

  if (input.password) {
    const password = String(input.password);
    if (password.length < 8) throw new AppError('Password must be at least 8 characters.');
    passwordHash = hashPassword(password);
  }

  if (input.pin) {
    const pin = String(input.pin).trim();
    if (!/^\d{4,6}$/.test(pin)) throw new AppError('PIN must be 4 to 6 digits.');
    pinHash = hashPassword(pin);
  }

  if (!passwordHash && !pinHash) {
    throw new AppError('Set a password or a PIN for this user.');
  }

  return insertUser({
    name,
    username,
    passwordHash: passwordHash ?? hashPassword(crypto.randomBytes(24).toString('hex')),
    role,
    branchId,
    pinHash
  });
}

export async function editUser(input) {
  const id = Number(input.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError('Choose a staff member.');
  const existing = await findUserById(id);
  if (!existing) throw new AppError('Choose a staff member.');

  const name = required(input.name, 'Staff name');
  const username = required(input.username, 'Username').toLowerCase();
  const role = requireOneOf(input.role, ['admin', 'cashier'], 'Role');
  const usernameOwner = await findUserByUsername(username);
  if (usernameOwner && Number(usernameOwner.id) !== id) {
    throw new AppError('That username is already taken.');
  }

  const branchId = role === 'cashier' ? Number(input.branchId) : null;
  if (role === 'cashier' && !branchId) {
    throw new AppError('Choose a branch for the cashier.');
  }

  let passwordHash;
  let pinHash;
  if (input.password) {
    const password = String(input.password);
    if (password.length < 8) throw new AppError('Password must be at least 8 characters.');
    passwordHash = hashPassword(password);
  }
  if (input.pin) {
    const pin = String(input.pin).trim();
    if (!/^\d{4,6}$/.test(pin)) throw new AppError('PIN must be 4 to 6 digits.');
    pinHash = hashPassword(pin);
  }

  await updateUser({
    id,
    name,
    username,
    role,
    branchId,
    active: input.active !== false && input.active !== 0,
    passwordHash,
    pinHash
  });
  return { id };
}
