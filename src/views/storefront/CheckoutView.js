'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStorefront } from './StorefrontProvider';
import { Field, Input, Select } from '../components/ui';
import { buildOrderMessage, buildWhatsappUrl, money } from '../../viewmodels/storefront/whatsapp';

const blankForm = {
  name: '',
  phone: '',
  payment: 'Pay on delivery',
  note: ''
};

export default function CheckoutView() {
  const { catalog, cart, subtotal, refreshCatalog, clearCart } = useStorefront();
  const [form, setForm] = useState(blankForm);
  const [attempted, setAttempted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const [revalidated, setRevalidated] = useState(false);

  // Prices in the bag are client-side, so a failed live refresh must block the
  // handoff rather than send an order based on stale catalogue data.
  useEffect(() => {
    let active = true;
    refreshCatalog().then((data) => {
      if (active) setRevalidated(Boolean(data));
    });
    return () => {
      active = false;
    };
  }, [refreshCatalog]);

  const nameError = form.name.trim().length < 2 ? 'Enter your name.' : '';
  const phoneDigits = form.phone.replace(/\D/g, '');
  const phoneError = phoneDigits.length < 8 || phoneDigits.length > 15
    ? 'Enter a valid phone number.'
    : '';

  const message = useMemo(() => buildOrderMessage({
    companyName: catalog.companyName,
    items: cart,
    customer: { name: form.name, phone: form.phone },
    payment: form.payment,
    note: form.note
  }), [catalog.companyName, cart, form]);

  const whatsappUrl = useMemo(
    () => buildWhatsappUrl(catalog.whatsappNumber, message),
    [catalog.whatsappNumber, message]
  );
  const valid = cart.length > 0 && !nameError && !phoneError && revalidated;

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const copyOrder = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      window.prompt('Copy your order text:', message);
    }
  };

  if (cart.length === 0) {
    return (
      <section className="shop-panel shop-empty">
        <span className="shop-empty-icon" aria-hidden="true">🧾</span>
        <h1>Nothing to check out</h1>
        <p>Add a pair to your bag first.</p>
        <a className="btn btn-primary" href="/shop">Browse sneakers</a>
      </section>
    );
  }

  return (
    <div className="shop-page shop-two-col">
      <section className="shop-panel">
        <div className="shop-panel-head">
          <div>
            <span className="shop-eyebrow">Almost there</span>
            <h1>Checkout</h1>
          </div>
          <a href="/shop/cart">Edit bag</a>
        </div>

        <div className="shop-form-grid">
          <Field label="Your name" required error={attempted ? nameError : ''}>
            <Input
              value={form.name}
              onChange={(event) => setField('name', event.target.value)}
              placeholder="e.g. Kwame Mensah"
              maxLength={60}
              required
            />
          </Field>
          <Field label="WhatsApp / phone number" required error={attempted ? phoneError : ''}>
            <Input
              type="tel"
              value={form.phone}
              onChange={(event) => setField('phone', event.target.value)}
              placeholder="024 123 4567"
              maxLength={30}
              required
            />
          </Field>
          <Field label="Payment preference">
            <Select value={form.payment} onChange={(event) => setField('payment', event.target.value)}>
              <option>Pay on delivery</option>
              <option>Mobile money</option>
              <option>Bank card</option>
              <option>Not sure yet</option>
            </Select>
          </Field>
          <Field label="Note for Sneakwise" hint="Delivery area, colour preference, or a question.">
            <textarea
              className="input shop-textarea"
              value={form.note}
              onChange={(event) => setField('note', event.target.value)}
              placeholder="Optional"
              maxLength={300}
              rows={3}
            />
          </Field>
        </div>

        <div className="shop-checkout-actions">
          {whatsappUrl && valid ? (
            <a
              className="btn btn-primary shop-whatsapp"
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setSent(true)}
            >
              Send order on WhatsApp
            </a>
          ) : (
            <button
              type="button"
              className="btn btn-primary shop-whatsapp"
              onClick={() => setAttempted(true)}
            >
              Send order on WhatsApp
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={copyOrder}
            disabled={!revalidated}
          >
            {copied ? 'Order copied ✓' : 'Copy order text'}
          </button>
        </div>

        {!revalidated && (
          <div className="alert alert-error" role="status">
            Live prices could not be checked. Reload this page before sending the order.
          </div>
        )}
        {!catalog.whatsappNumber && (
          <div className="alert alert-warn" role="status">
            The shop WhatsApp number has not been configured yet. Copy the order text and send it manually, or ask the owner to set it in Admin → Shop settings.
          </div>
        )}
        {sent && (
          <div className="alert alert-success" role="status">
            Your order opened in WhatsApp. Send the message there, then clear your bag below.
          </div>
        )}
        {sent && (
          <button type="button" className="btn btn-ghost" onClick={clearCart}>
            I sent it — clear my bag
          </button>
        )}
      </section>

      <aside className="shop-panel shop-summary">
        <h2>Order preview</h2>
        <div className="shop-preview-lines">
          {cart.map((item) => (
            <div className="shop-preview-row" key={item.key}>
              <span>
                <strong>{item.qty} × {item.name}</strong>
                <small>{item.size ? `${item.sizeLabel}: ${item.size}` : 'One size'} · {item.sku}</small>
              </span>
              <strong>{money(item.price * item.qty)}</strong>
            </div>
          ))}
        </div>
        <div className="shop-summary-total">
          <span>Total</span>
          <strong>{money(subtotal)}</strong>
        </div>
        <details className="shop-message-preview">
          <summary>Preview WhatsApp message</summary>
          <pre>{message}</pre>
        </details>
        <p className="muted">No payment is taken here. Sneakwise confirms stock and payment in WhatsApp, then records the sale in-store.</p>
      </aside>
    </div>
  );
}
