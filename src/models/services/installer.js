import { createSchema, database, insertIgnoreSql } from '../database';
import { AppError } from '../errors';
import { hashPassword } from '../security';
import { isInstalled, setSetting } from '../repositories/settings';
import { findBranchByCode, insertBranch } from '../repositories/branches';
import { findUserByUsername, insertUser } from '../repositories/users';
import { findProductBySku, insertProduct } from '../repositories/products';
import { findCustomerByPhone, insertCustomer } from '../repositories/customers';
import { normalizeCode, required } from '../validation';

const demoProducts = [
  { sku: 'DS-ANK-BLK-M', name: 'Ankara dress, black', category: 'clothing', size: 'M', price: 180, cost: 95 },
  { sku: 'DS-ANK-BLK-L', name: 'Ankara dress, black', category: 'clothing', size: 'L', price: 180, cost: 95 },
  { sku: 'DS-ANK-RED-L', name: 'Ankara dress, red', category: 'clothing', size: 'L', price: 190, cost: 100 },
  { sku: 'HB-014-WHT', name: 'White handbag', category: 'accessories', size: null, price: 120, cost: 60 },
  { sku: 'SC-022-GLD', name: 'Gold scarf', category: 'accessories', size: null, price: 65, cost: 28 },
  { sku: 'SH-NVY-39', name: 'Navy sandals', category: 'shoes', size: '39', price: 150, cost: 80 },
  { sku: 'SH-NVY-40', name: 'Navy sandals', category: 'shoes', size: '40', price: 150, cost: 80 }
];

const demoCustomers = [
  { name: 'Ama Mensah', phone: '0244123456' },
  { name: 'Kwesi Boateng', phone: '0201234567' },
  { name: 'Efua Danso', phone: '0552345678' }
];

export async function prepareDatabase() {
  await createSchema();
}

export async function installApplication(input) {
  await createSchema();

  if (await isInstalled()) {
    throw new AppError('This application has already been installed.');
  }

  const companyName = required(input.companyName, 'Company name');
  const adminName = required(input.admin?.name, 'Admin name');
  const username = required(input.admin?.username, 'Admin username').toLowerCase();
  const password = required(input.admin?.password, 'Admin password');

  if (password.length < 8) {
    throw new AppError('Admin password must be at least 8 characters.');
  }
  if (await findUserByUsername(username)) {
    throw new AppError('That admin username is already taken.');
  }

  const branches = (input.branches ?? []).filter((branch) => branch?.name?.trim());
  if (branches.length === 0) {
    throw new AppError('Add at least one branch.');
  }

  const branchIds = [];
  for (const branch of branches) {
    const code = normalizeCode(branch.code || branch.name);
    if (await findBranchByCode(code)) {
      throw new AppError(`Branch code ${code} is already used.`);
    }
    branchIds.push(await insertBranch(branch.name.trim(), code));
  }

  await insertUser({
    name: adminName,
    username,
    passwordHash: hashPassword(password),
    role: 'admin',
    branchId: null
  });

  if (input.seed) {
    await loadDemoData(branchIds[0]);
  }

  await setSetting('installed', '1');
  await setSetting('installed_at', new Date().toISOString());
  await setSetting('company_name', companyName);

  return { companyName, branches: branches.length };
}

async function loadDemoData(branchId) {
  for (const product of demoProducts) {
    if (!(await findProductBySku(product.sku))) {
      await insertProduct(product);
    }
  }

  const products = await database.execute('SELECT id FROM products ORDER BY id ASC');
  for (const product of products.rows) {
    await database.execute({
      sql: insertIgnoreSql('stock', 'branch_id, product_id, qty, low_at', '?, ?, ?, ?', 'branch_id, product_id'),
      args: [branchId, product.id, 12, 3]
    });
  }

  for (const customer of demoCustomers) {
    if (!(await findCustomerByPhone(customer.phone))) {
      await insertCustomer({
        name: customer.name,
        phone: customer.phone,
        consentAt: new Date().toISOString()
      });
    }
  }
}
