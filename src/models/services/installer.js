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
  { sku: 'SN-NVY-41', name: 'Navy low-top sneakers', category: 'shoes', size: '41', price: 320, cost: 170 },
  { sku: 'SN-NVY-42', name: 'Navy low-top sneakers', category: 'shoes', size: '42', price: 320, cost: 170 },
  { sku: 'SN-WHT-43', name: 'White court sneakers', category: 'shoes', size: '43', price: 340, cost: 180 },
  { sku: 'SN-BLK-44', name: 'Black runners', category: 'shoes', size: '44', price: 360, cost: 195 },
  { sku: 'SL-SND-40', name: 'Sand slide sandals', category: 'slides', size: '40', price: 140, cost: 65 },
  { sku: 'AC-SCK-01', name: 'White crew socks', category: 'accessories', size: null, price: 35, cost: 15 },
  { sku: 'AC-LCE-01', name: 'Replacement laces', category: 'accessories', size: null, price: 20, cost: 8 }
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
