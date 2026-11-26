const sneakerSizes = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47'];

export const productCategories = [
  {
    id: 'shoes',
    label: 'Sneakers',
    sizeLabel: 'EU size',
    sizes: sneakerSizes
  },
  {
    id: 'slides',
    label: 'Slides & sandals',
    sizeLabel: 'EU size',
    sizes: sneakerSizes
  },
  {
    id: 'other',
    label: 'Sneaker extras',
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
