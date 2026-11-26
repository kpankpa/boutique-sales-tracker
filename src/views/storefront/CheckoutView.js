'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStorefront } from './StorefrontProvider';
import { Field, Input } from '../components/ui';
import { buildOrderMessage, buildWhatsappUrl, money } from '../../viewmodels/storefront/whatsapp';
import { trackShopEvent } from '../../viewmodels/storefront/analytics';

const blankForm = {
  name: '',
  phone: '',
  delivery: '',
  payment: '',
  note: ''
};

export default function CheckoutView() {
  const { catalog, cart, subtotal, refreshCatalog, clearCart, orderReference } = useStorefront();
  const [form, setForm] = useState(blankForm);
  const [attempted, setAttempted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const [revalidated, setRevalidated] = useState(false);
  const started = useRef(false);

  const deliveryOptions = useMemo(
    () => catalog.deliveryOptions?.length ? catalog.deliveryOptions : ['Delivery details confirmed on WhatsApp'],
    [catalog.deliveryOptions]
  );
  const paymentOptions = useMemo(
    () => catalog.paymentOptions?.length ? catalog.paymentOptions : ['Pay on delivery'],
    [catalog.paymentOptions]
  );

  useEffect(() => {
    setForm((current) => ({
      ...current,
      delivery: current.delivery || deliveryOptions[0],
      payment: current.payment || paymentOptions[0]
    }));
  }, [deliveryOptions, paymentOptions]);

  // Prices in the bag are client-side, so a failed live refresh must block the
  // handoff rather than send an order based on stale catalogue data.
  useEffect(() => {
    let active = true;
    refreshCatalog().then((data) => {
      if (active) setRevalidated(Boolean(data));
    });
    return () => { active = false; };
  }, [refreshCatalog]);

  useEffect(() => {
    if (started.current || cart.length === 0) return;
    started.current = true;
    trackShopEvent('checkout_start', { meta: { lines: cart.length, reference: orderReference } });
  }, [cart.length, orderReference]);

  const nameError = form.name.trim().length < 2 ? 'Enter your name.' : '';
  const phoneDigits = form.phone.replace(/\D/g, '');
  const phoneError = phoneDigits.length < 8 || phoneDigits.length > 15 ? 'Enter a valid phone number.' : '';
  const deliveryError = form.delivery ? '' : 'Choose how you want to receive the order.';
  const paymentError = form.payment ? '' : 'Choose a payment preference.';

  const message = useMemo(() => buildOrderMessage({
    companyName: catalog.companyName,
    items: cart,
    customer: { name: form.name, phone: form.phone },
    delivery: form.delivery,
    payment: form.payment,
    note: form.note,
    reference: orderReference
  }), [catalog.companyName, cart, form, orderReference]);

  const whatsappUrl = useMemo(
    () => buildWhatsappUrl(catalog.whatsappNumber, message),
    [catalog.whatsappNumber, message]
  );
  const valid = cart.length > 0 && !nameError && !phoneError && !deliveryError && !paymentError && revalidated;

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const copyOrder = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      trackShopEvent('order_copied', { meta: { source: 'checkout', lines: cart.length, reference: orderReference } });
    } catch {
      window.prompt('Copy your order text:', message);
    }
  };

  const openWhatsapp = () => {
    trackShopEvent('whatsapp_click', {
      meta: { source: 'checkout', lines: cart.length, delivery: form.delivery, reference: orderReference }
    });
    setSent(true);
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

  const choiceGroup = (name, legend, options, error) => (
    <fieldset className="shop-choice-group" aria-invalid={Boolean(error)}>
      <legend>{legend}</legend>
      <div className="shop-choice-grid">
        {options.map((option) => (
          <label
            key={option}
            className={`shop-choice${form[name] === option ? ' active' : ''}`}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={form[name] === option}
              onChange={() => setField(name, option)}
            />
            <span className="shop-choice-dot" aria-hidden="true" />
            <span>{option}</span>
          </label>
        ))}
      </div>
      {error && <small className="shop-field-error">{error}</small>}
    </fieldset>
  );

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
            <Input value={form.name} onChange={(event) => setField('name', event.target.value)} placeholder="e.g. Kwame Mensah" maxLength={60} required />
          </Field>
          <Field label="WhatsApp / phone number" required error={attempted ? phoneError : ''}>
            <Input type="tel" value={form.phone} onChange={(event) => setField('phone', event.target.value)} placeholder="024 123 4567" maxLength={30} required />
          </Field>
          {choiceGroup('delivery', 'Delivery preference', deliveryOptions, attempted ? deliveryError : '')}
          {choiceGroup('payment', 'Payment preference', paymentOptions, attempted ? paymentError : '')}
          <Field label="Anything else?" hint="Optional note for Sneakwise. Do not enter card or MoMo PIN details.">
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
              onClick={openWhatsapp}
            >
              Send order on WhatsApp
            </a>
          ) : (
            <button type="button" className="btn btn-primary shop-whatsapp" onClick={() => setAttempted(true)}>
              Send order on WhatsApp
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={copyOrder} disabled={!revalidated}>
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
        {sent && <button type="button" className="btn btn-ghost" onClick={clearCart}>I sent it — clear my bag</button>}
      </section>

      <aside className="shop-panel shop-summary">
        <div className="shop-summary-head">
          <h2>Order preview</h2>
          <span className="shop-ref-badge"><span>Ref</span><strong>{orderReference || '—'}</strong></span>
        </div>
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
