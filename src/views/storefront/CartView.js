'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStorefront } from './StorefrontProvider';
import { buildOrderMessage, buildWhatsappUrl, money } from '../../viewmodels/storefront/whatsapp';

export default function CartView() {
  const { catalog, cart, subtotal, updateQty, removeFromCart } = useStorefront();
  const [copied, setCopied] = useState(false);

  const orderMessage = useMemo(
    () => buildOrderMessage({ companyName: catalog.companyName, items: cart }),
    [catalog.companyName, cart]
  );
  const orderUrl = useMemo(
    () => buildWhatsappUrl(catalog.whatsappNumber, orderMessage),
    [catalog.whatsappNumber, orderMessage]
  );

  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copyOrder = async () => {
    try {
      await navigator.clipboard.writeText(orderMessage);
      setCopied(true);
    } catch {
      window.prompt('Copy your order text:', orderMessage);
    }
  };

  if (cart.length === 0) {
    return (
      <section className="shop-panel shop-empty">
        <span className="shop-empty-icon" aria-hidden="true">🛍️</span>
        <h1>Your bag is empty</h1>
        <p>Pick a pair you love and it will show up here.</p>
        <a className="btn btn-primary" href="/shop">Browse sneakers</a>
      </section>
    );
  }

  return (
    <div className="shop-page shop-two-col">
      <section className="shop-panel">
        <div className="shop-panel-head">
          <div>
            <span className="shop-eyebrow">Your selection</span>
            <h1>Shopping bag</h1>
          </div>
          <span className="muted">{cart.length} {cart.length === 1 ? 'line' : 'lines'}</span>
        </div>
        <div className="shop-lines">
          {cart.map((item) => (
            <article className="shop-line" key={item.key}>
              <div className="shop-line-media">
                {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span aria-hidden="true">👟</span>}
              </div>
              <div className="shop-line-info">
                <strong>{item.name}</strong>
                <span>{item.size ? `${item.sizeLabel}: ${item.size}` : 'One size'} · {item.sku}</span>
                <span className="muted">{money(item.price)} each</span>
              </div>
              <div className="shop-line-actions">
                <div className="shop-stepper" aria-label={`Quantity for ${item.name}`}>
                  <button
                    type="button"
                    onClick={() => updateQty(item.key, item.qty - 1)}
                    aria-label={`Remove one ${item.name}`}
                  >
                    −
                  </button>
                  <span>{item.qty}</span>
                  <button
                    type="button"
                    onClick={() => updateQty(item.key, item.qty + 1)}
                    disabled={item.qty >= item.units}
                    aria-label={`Add one ${item.name}`}
                  >
                    +
                  </button>
                </div>
                <strong>{money(item.price * item.qty)}</strong>
                <button type="button" className="shop-remove" onClick={() => removeFromCart(item.key)}>
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <aside className="shop-panel shop-summary">
        <h2>Order summary</h2>
        <div className="shop-summary-row">
          <span>Subtotal</span>
          <strong>{money(subtotal)}</strong>
        </div>
        <div className="shop-summary-row">
          <span>Delivery</span>
          <span>Confirmed on WhatsApp</span>
        </div>
        <div className="shop-summary-total">
          <span>Total</span>
          <strong>{money(subtotal)}</strong>
        </div>

        {orderUrl ? (
          <a
            className="btn shop-whatsapp shop-checkout-link"
            href={orderUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Send bag on WhatsApp
          </a>
        ) : (
          <button type="button" className="btn shop-whatsapp shop-checkout-link" onClick={copyOrder}>
            {copied ? 'Order copied ✓' : 'Copy bag order'}
          </button>
        )}
        <a className="btn btn-secondary shop-checkout-link" href="/shop/checkout">
          Add delivery details
        </a>
        <p className="muted">
          Stock is not reserved until Sneakwise confirms your order. The message includes every pair and size in your bag.
        </p>
      </aside>
    </div>
  );
}
