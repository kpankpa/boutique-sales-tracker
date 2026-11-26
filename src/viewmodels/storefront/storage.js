const CART_KEY = 'sneakwise.shop.cart.v1';
const WISHLIST_KEY = 'sneakwise.shop.wishlist.v1';
const MAX_CART_LINES = 30;

export function cartKey(product) {
  return `${product.id}::${product.size || 'one-size'}`;
}

function readJson(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing or a full quota must not break shopping.
  }
}

function normalizeCartItem(row) {
  const id = Number(row?.productId ?? row?.id);
  const qty = Number(row?.qty);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(qty) || qty <= 0) return null;
  return {
    key: String(row.key || `${id}::${row.size || 'one-size'}`),
    productId: id,
    sku: String(row.sku || ''),
    name: String(row.name || ''),
    categoryLabel: String(row.categoryLabel || ''),
    size: row.size ? String(row.size) : null,
    sizeLabel: String(row.sizeLabel || 'Size'),
    imageUrl: row.imageUrl || null,
    price: Number(row.price) || 0,
    units: Math.max(0, Number(row.units) || 0),
    qty: Math.min(qty, 99)
  };
}

export function readCart() {
  const rows = readJson(CART_KEY, []);
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, MAX_CART_LINES).map(normalizeCartItem).filter(Boolean);
}

export function writeCart(items) {
  writeJson(CART_KEY, items.slice(0, MAX_CART_LINES));
}

export function readWishlist() {
  const rows = readJson(WISHLIST_KEY, []);
  if (!Array.isArray(rows)) return [];
  return [...new Set(rows.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
}

export function writeWishlist(ids) {
  writeJson(WISHLIST_KEY, ids);
}

// Fresh catalogue data replaces stale prices and stock. Sold-out lines are
// dropped so checkout cannot send an item the shop can no longer confirm.
export function reconcileCart(items, products) {
  const fresh = new Map(products.map((product) => [product.id, product]));
  return items.flatMap((item) => {
    const product = fresh.get(item.productId);
    if (!product || !product.available) return [];
    return [{
      ...item,
      sku: product.sku,
      name: product.name,
      categoryLabel: product.categoryLabel,
      size: product.size,
      sizeLabel: product.sizeLabel,
      imageUrl: product.imageUrl,
      price: product.price,
      units: product.units,
      qty: Math.min(item.qty, product.units)
    }];
  }).slice(0, MAX_CART_LINES);
}
