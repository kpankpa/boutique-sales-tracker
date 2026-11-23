import { AppError } from './errors';

export function required(value, label) {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new AppError(`${label} is required.`);
  }
  return String(value).trim();
}

export function positiveNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new AppError(`${label} must be greater than zero.`);
  }
  return number;
}

export function nonNegativeNumber(value, label, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new AppError(`${label} cannot be negative.`);
  }
  return number;
}

export function normalizeCode(value) {
  return required(value, 'Code')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Product images are either a small compressed data URL (no S3 configured)
// or a public HTTPS URL returned by an S3 upload.
const MAX_INLINE_IMAGE_CHARS = 500000;
const MAX_IMAGE_URL_CHARS = 2048;

export function normalizeImageUrl(value) {
  if (value === undefined || value === null || value === '') return null;
  const image = String(value).trim();
  if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image) && image.length <= MAX_INLINE_IMAGE_CHARS) {
    return image;
  }
  if (image.length <= MAX_IMAGE_URL_CHARS && /^https:\/\/[^\s"'<>]+$/i.test(image)) {
    return image;
  }
  throw new AppError('Invalid product image.');
}

export function normalizeBarcode(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const barcode = String(value).trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9\-_.]{2,63}$/.test(barcode)) {
    throw new AppError('Barcode must be 3–64 characters: letters, digits, dashes, dots or underscores.');
  }
  return barcode;
}

export function requireOneOf(value, options, label) {
  if (!options.includes(value)) {
    throw new AppError(`${label} must be one of: ${options.join(', ')}.`);
  }
  return value;
}
