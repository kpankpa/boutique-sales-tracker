import { AppError } from '../errors';
import { addAudit, listStockTotals } from '../repositories/activity';
import { listCategories } from '../repositories/categories';
import { listPublicProducts } from '../repositories/products';
import { getSetting, setSetting } from '../repositories/settings';
import { categoryLabel } from '../productOptions';
import { required } from '../validation';

const DEFAULT_COMPANY = 'Sneakwise';

// WhatsApp deep links need digits only. Ghana local numbers and the 00
// international prefix are normalised to the 233 country code.
export function normalizeWhatsappNumber(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  const digits = value.replace(/\D/g, '').replace(/^00/, '');
  if (digits.length < 8 || digits.length > 15) {
    throw new AppError('Enter a valid WhatsApp number with country code.');
  }
  if (digits.startsWith('233') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return `233${digits.slice(1)}`;
  if (digits.length === 9) return `233${digits}`;
  return digits;
}

function safeNumber(raw) {
  try {
    return normalizeWhatsappNumber(raw);
  } catch {
    return '';
  }
}

export async function getShopSettings() {
  const [company, number] = await Promise.all([
    getSetting('company_name'),
    getSetting('whatsapp_number')
  ]);
  return {
    companyName: String(company || '').trim() || DEFAULT_COMPANY,
    whatsappNumber: safeNumber(number || process.env.STORE_WHATSAPP_NUMBER || '')
  };
}

export async function updateShopSettings(user, input = {}) {
  const current = await getShopSettings();
  const companyName = input.companyName === undefined
    ? current.companyName
    : required(input.companyName, 'Company name').slice(0, 80);
  const whatsappNumber = input.whatsappNumber === undefined
    ? current.whatsappNumber
    : normalizeWhatsappNumber(input.whatsappNumber);

  await Promise.all([
    setSetting('company_name', companyName),
    setSetting('whatsapp_number', whatsappNumber)
  ]);
  await addAudit(
    user.id,
    'update_shop_settings',
    'settings',
    0,
    { companyName, whatsappConfigured: Boolean(whatsappNumber) }
  );
  return { companyName, whatsappNumber };
}

export async function getShopCatalog() {
  const [settings, categories, products, stock] = await Promise.all([
    getShopSettings(),
    listCategories(),
    listPublicProducts(),
    listStockTotals()
  ]);

  const allCategories = new Map(categories.map((category) => [category.id, category]));
  const activeCategories = categories.filter((category) => Number(category.active) === 1);
  const categoryMap = new Map(activeCategories.map((category) => [category.id, category]));
  const unitsByProduct = new Map(stock.map((row) => [row.productId, row.units]));

  return {
    companyName: settings.companyName,
    whatsappNumber: settings.whatsappNumber,
    categories: activeCategories.map((category) => ({
      id: category.id,
      name: category.name,
      sizeLabel: category.sizeLabel,
      sizes: category.sizes
    })),
    // Products in disabled categories are hidden too, so the public grid never
    // shows an item that has no category chip or correct size label.
    products: products.flatMap((product) => {
      const configured = allCategories.get(product.category);
      if (configured && Number(configured.active) !== 1) return [];
      const category = categoryMap.get(product.category);
      const units = unitsByProduct.get(Number(product.id)) ?? 0;
      return [{
        id: Number(product.id),
        sku: product.sku,
        name: product.name,
        category: product.category,
        categoryLabel: category?.name || categoryLabel(product.category),
        size: product.size || null,
        sizeLabel: category?.sizeLabel || 'Size',
        imageUrl: product.image_url || null,
        price: Number(product.price) || 0,
        units,
        available: units > 0
      }];
    })
  };
}
