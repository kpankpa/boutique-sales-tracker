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

export function requireOneOf(value, options, label) {
  if (!options.includes(value)) {
    throw new AppError(`${label} must be one of: ${options.join(', ')}.`);
  }
  return value;
}
