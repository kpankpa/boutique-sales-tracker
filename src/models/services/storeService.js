import { AppError } from '../errors';
import { addAudit, listStockTotals } from '../repositories/activity';
import { listCategories } from '../repositories/categories';
import { listPublicProducts } from '../repositories/products';
import { getSetting, setSetting } from '../repositories/settings';
import { categoryLabel } from '../productOptions';
import { required } from '../validation';

const DEFAULT_COMPANY = 'Sneakwise';

const DEFAULT_DELIVERY_OPTIONS = [
  'Pickup at Sneakwise — confirmed on WhatsApp',
  'Delivery in Accra — confirmed on WhatsApp',
  'Delivery outside Accra — confirmed on WhatsApp'
];

const DEFAULT_PAYMENT_OPTIONS = [
  'Pay on delivery',
  'Mobile money after confirmation',
  'Bank transfer after confirmation',
  'Not sure yet'
];

const SIZE_GUIDE = {
  title: 'Sneaker size guide',
  note: 'Sizes are approximate. If you are between sizes, choose the larger one or ask Sneakwise on WhatsApp.',
  columns: ['EU', 'UK', 'US', 'Foot length'],
  rows: [
    ['36', '3.5', '4', '23 cm'],
    ['37', '4', '4.5', '23.5 cm'],
    ['38', '5', '5.5', '24 cm'],
    ['39', '6', '6.5', '24.5 cm'],
    ['40', '6.5', '7.5', '25 cm'],
    ['41', '7.5', '8.5', '26 cm'],
    ['42', '8.5', '9.5', '27 cm'],
    ['43', '9.5', '10.5', '27.5 cm'],
    ['44', '10', '11', '28 cm'],
    ['45', '10.5', '11.5', '28.5 cm'],
    ['46', '11', '12', '29 cm'],
    ['47', '11.5', '12.5', '29.5 cm']
  ]
};

// The public shop is a sneaker boutique. Legacy non-footwear seeds are removed
// from the admin catalogue; staff-only extras still never reach shoppers.
const FOOTWEAR_IDS = new Set(['shoes', 'slides', 'sneakers', 'trainers', 'sandals']);
const FOOTWEAR_LABEL = /sneaker|shoe|slide|sandal|trainer|footwear|kicks/i;
const STAFF_ONLY_IDS = new Set(['other']);

function isFootwearCategory(category) {
  if (STAFF_ONLY_IDS.has(category.id)) return false;
  return FOOTWEAR_IDS.has(category.id) || FOOTWEAR_LABEL.test(String(category.name || ''));
}

function parseOptionList(raw, fallback, max = 12, maxLength = 60) {
  if (raw === undefined || raw === null) return fallback;
  const values = Array.isArray(raw)
    ? raw
    : String(raw).split(/[\n,]/);
  const seen = new Set();
  const options = [];
  for (const entry of values) {
    const value = String(entry ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    options.push(value);
    if (options.length >= max) break;
  }
  return options.length ? options : fallback;
}

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
  const [company, number, deliveryRaw, paymentRaw] = await Promise.all([
    getSetting('company_name'),
    getSetting('whatsapp_number'),
    getSetting('store_delivery_options'),
    getSetting('store_payment_options')
  ]);
  let deliveryOptions = DEFAULT_DELIVERY_OPTIONS;
  let paymentOptions = DEFAULT_PAYMENT_OPTIONS;
  try { deliveryOptions = parseOptionList(JSON.parse(deliveryRaw || 'null'), DEFAULT_DELIVERY_OPTIONS); } catch {}
  try { paymentOptions = parseOptionList(JSON.parse(paymentRaw || 'null'), DEFAULT_PAYMENT_OPTIONS); } catch {}
  return {
    companyName: String(company || '').trim() || DEFAULT_COMPANY,
    whatsappNumber: safeNumber(number || process.env.STORE_WHATSAPP_NUMBER || ''),
    deliveryOptions,
    paymentOptions,
    sizeGuide: SIZE_GUIDE
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
  const deliveryOptions = input.deliveryOptions === undefined
    ? current.deliveryOptions
    : parseOptionList(input.deliveryOptions, DEFAULT_DELIVERY_OPTIONS);
  const paymentOptions = input.paymentOptions === undefined
    ? current.paymentOptions
    : parseOptionList(input.paymentOptions, DEFAULT_PAYMENT_OPTIONS);

  await Promise.all([
    setSetting('company_name', companyName),
    setSetting('whatsapp_number', whatsappNumber),
    setSetting('store_delivery_options', JSON.stringify(deliveryOptions)),
    setSetting('store_payment_options', JSON.stringify(paymentOptions))
  ]);
  await addAudit(
    user.id,
    'update_shop_settings',
    'settings',
    0,
    {
      companyName,
      whatsappConfigured: Boolean(whatsappNumber),
      deliveryOptions: deliveryOptions.length,
      paymentOptions: paymentOptions.length
    }
  );
  return { companyName, whatsappNumber, deliveryOptions, paymentOptions, sizeGuide: SIZE_GUIDE };
}

// Public product detail: still only the safe catalogue projection, plus
// same-style variants and a small "you may also like" set of sneakers.
export async function getShopProduct(productId) {
  const catalog = await getShopCatalog();
  const id = Number(productId);
  if (!Number.isInteger(id) || id <= 0) return null;

  const product = catalog.products.find((row) => row.id === id);
  if (!product) return null;

  const variants = catalog.products
    .filter((row) => row.name === product.name && row.category === product.category)
    .sort((a, b) => String(a.size || '').localeCompare(String(b.size || ''), undefined, { numeric: true }));

  const priceBand = Math.floor(product.price / 100);
  const recommendations = catalog.products
    .filter((row) => row.id !== product.id)
    .map((row) => ({
      product: row,
      score: (row.category === product.category ? 4 : 0)
        + (Math.floor(row.price / 100) === priceBand ? 2 : 0)
        + (row.available ? 1 : 0)
    }))
    .sort((a, b) => (
      b.score - a.score
      || Math.abs(a.product.price - product.price) - Math.abs(b.product.price - product.price)
      || String(a.product.name).localeCompare(String(b.product.name))
      || a.product.id - b.product.id
    ))
    .slice(0, 4)
    .map((entry) => entry.product);

  return {
    product,
    variants,
    recommendations,
    companyName: catalog.companyName,
    whatsappNumber: catalog.whatsappNumber,
    sizeGuide: catalog.sizeGuide,
    deliveryOptions: catalog.deliveryOptions,
    paymentOptions: catalog.paymentOptions
  };
}

export async function getShopCatalog() {
  const [settings, categories, products, stock] = await Promise.all([
    getShopSettings(),
    listCategories(),
    listPublicProducts(),
    listStockTotals()
  ]);

  const allCategories = new Map(categories.map((category) => [category.id, category]));
  const activeCategories = categories.filter(
    (category) => Number(category.active) === 1 && isFootwearCategory(category)
  );
  const categoryMap = new Map(activeCategories.map((category) => [category.id, category]));
  const unitsByProduct = new Map(stock.map((row) => [row.productId, row.units]));

  return {
    companyName: settings.companyName,
    whatsappNumber: settings.whatsappNumber,
    deliveryOptions: settings.deliveryOptions,
    paymentOptions: settings.paymentOptions,
    sizeGuide: settings.sizeGuide,
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
      // Unknown or non-footwear categories are POS-only; only sneaker pairs
      // and slides are published to shoppers.
      if (!category) return [];
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
