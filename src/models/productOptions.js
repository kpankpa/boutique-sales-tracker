export const productCategories = [
  {
    id: 'shoes',
    label: 'Shoes',
    sizeLabel: 'Shoe size',
    sizes: ['38', '39', '40', '41', '42', '43', '44', '45', '46']
  },
  {
    id: 'clothing',
    label: 'Dresses / shirts',
    sizeLabel: 'Clothing size',
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free size']
  },
  {
    id: 'trousers',
    label: 'Trousers / shorts',
    sizeLabel: 'Waist size',
    sizes: ['28', '30', '32', '34', '36', '38', '40', '42']
  },
  {
    id: 'accessories',
    label: 'Accessories / no size',
    sizeLabel: 'Size',
    sizes: []
  },
  {
    id: 'other',
    label: 'Other',
    sizeLabel: 'Size',
    sizes: []
  }
];

export function normalizeCategory(value) {
  const category = String(value ?? 'other')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return category || 'other';
}

export function categoryLabel(categoryId) {
  const preset = productCategories.find((category) => category.id === categoryId);
  if (preset) return preset.label;
  const raw = String(categoryId ?? '').trim();
  if (!raw) return 'Other';
  return raw
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function normalizeSize(value) {
  const size = String(value ?? '').trim();
  return size ? size.slice(0, 24) : null;
}

export function sizeToken(size) {
  return String(size)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 12);
}

export function displayProductName(name, size) {
  return size ? `${name} (${size})` : name;
}
