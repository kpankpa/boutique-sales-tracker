const MAX_NOTE_CHARS = 300;
const MAX_NAME_CHARS = 60;
const MAX_PHONE_CHARS = 30;
const MAX_REF_CHARS = 24;

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

// Short, non-sensitive handoff reference. It is generated in the browser and
// never creates an order or customer record.
export function makeOrderRef(now = new Date()) {
  const date = [
    String(now.getUTCFullYear()).slice(-2),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0')
  ].join('');
  const random = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, '0');
  return `SW-${date}-${random}`;
}

export function buildOrderMessage({ companyName, items, customer, delivery = '', payment = '', note = '', reference = '' }) {
  const lines = [`*NEW ORDER — ${cleanLine(companyName || 'Sneakwise', 50)}*`];
  const ref = cleanLine(reference, MAX_REF_CHARS);
  if (ref) lines.push(`*Ref:* ${ref}`);
  if (customer?.name || customer?.phone) {
    lines.push('');
    if (customer?.name) lines.push(`*Customer:* ${cleanLine(customer.name, MAX_NAME_CHARS)}`);
    if (customer?.phone) lines.push(`*Phone:* ${cleanLine(customer.phone, MAX_PHONE_CHARS)}`);
  }
  if (delivery) lines.push(`*Delivery:* ${cleanLine(delivery, 80)}`);
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
export function buildProductMessage({ companyName, product, reference = '' }) {
  return buildOrderMessage({
    companyName,
    items: [{ ...product, qty: 1 }],
    reference
  });
}

export function buildWhatsappUrl(number, message) {
  const digits = String(number || '').replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
