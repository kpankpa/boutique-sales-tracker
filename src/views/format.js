export function money(value) {
  return `GH₵ ${Number(value || 0).toFixed(2)}`;
}

export function dateTime(value) {
  if (!value) return '—';
  const normalized = String(value).replace(' ', 'T');
  const date = new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}
