const MAX_NOTE_CHARS = 300;
const MAX_NAME_CHARS = 60;
const MAX_PHONE_CHARS = 30;

function cleanLine(value, max = 120) {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, max);
}

export function money(value) {
  return `GH₵ ${Number(value || 0).toFixed(2)}`;
}

export function cartSubtotal(items) {
  return items.reduce((total, item) => total + item.price * item.qty, 0);
}

export function buildOrderMessage({ companyName, items, customer, payment = '', note = '' }) {
  const lines = [`*NEW ORDER — ${cleanLine(companyName || 'Sneakwise', 50)}*`];
  if (customer?.name || customer?.phone) {
    lines.push('');
    if (customer?.name) lines.push(`*Customer:* ${cleanLine(customer.name, MAX_NAME_CHARS)}`);
    if (customer?.phone) lines.push(`*Phone:* ${cleanLine(customer.phone, MAX_PHONE_CHARS)}`);
  }
  if (payment) lines.push(`*Payment preference:* ${cleanLine(payment, 40)}`);
  if (note) lines.push(`*Note:* ${cleanLine(note, MAX_NOTE_CHARS)}`);

  lines.push('', '*Items:*');
  items.forEach((item, index) => {
    const size = item.size ? `${item.sizeLabel || 'Size'}: ${item.size}` : 'One size';
    lines.push(`${index + 1}. ${cleanLine(item.name, 70)} — ${size} — ${cleanLine(item.sku, 30)}`);
    lines.push(`   ${item.qty} × ${money(item.price)} = ${money(item.qty * item.price)}`);
  });

  lines.push('', `*TOTAL: ${money(cartSubtotal(items))}*`);
  lines.push('Please confirm availability and delivery details. Thank you!');
  return lines.join('\n');
}

// One-tap order from a product card or quick action. The selected size is
// already embedded in the product row, so no variant lookup is needed here.
export function buildProductMessage({ companyName, product }) {
  return buildOrderMessage({
    companyName,
    items: [{ ...product, qty: 1 }]
  });
}

export function buildWhatsappUrl(number, message) {
  const digits = String(number || '').replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
