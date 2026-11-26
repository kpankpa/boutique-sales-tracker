'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { apiGet } from '../../viewmodels/api';
import { useStorefront } from './StorefrontProvider';
import { trackShopEvent } from '../../viewmodels/storefront/analytics';
import { buildProductMessage, buildWhatsappUrl, money } from '../../viewmodels/storefront/whatsapp';

function stockLabel(product) {
  if (!product?.available) return 'Sold out';
  return product.units <= 3 ? `Only ${product.units} left` : 'Available';
}

export default function ProductDetailView({ productId }) {
  const { addToCart, toggleWishlist, isWishlisted, orderReference } = useStorefront();
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(Number(productId));
  const [added, setAdded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const opened = useRef('');

  useEffect(() => {
    let active = true;
    setDetail(null);
    setError('');
    apiGet(`/shop/product?id=${encodeURIComponent(productId)}`)
      .then((data) => {
        if (!active) return;
        setDetail(data);
        setSelectedId(data.product?.id || Number(productId));
      })
      .catch((failure) => {
        if (active) setError(failure.message || 'This pair could not be loaded.');
      });
    return () => { active = false; };
  }, [productId]);

  const variants = detail?.variants?.length ? detail.variants : detail?.product ? [detail.product] : [];
  const selected = variants.find((row) => row.id === selectedId) || detail?.product || null;

  useEffect(() => {
    if (!selected || !detail) return;
    const key = `${productId}:${selected.id}`;
    if (opened.current === key) return;
    opened.current = key;
    trackShopEvent('product_open', {
      productId: selected.id,
      category: selected.category,
      meta: { sku: selected.sku, source: 'detail' }
    });
  }, [detail, productId, selected]);

  useEffect(() => {
    if (!added && !copied) return undefined;
    const timer = window.setTimeout(() => { setAdded(false); setCopied(false); }, 1600);
    return () => window.clearTimeout(timer);
  }, [added, copied]);

  const message = useMemo(() => selected
    ? buildProductMessage({
      companyName: detail.companyName,
      product: selected,
      reference: orderReference
    })
    : '',
  [detail?.companyName, orderReference, selected]);

  const whatsappUrl = useMemo(
    () => buildWhatsappUrl(detail?.whatsappNumber, message),
    [detail?.whatsappNumber, message]
  );

  const copyOrder = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      trackShopEvent('order_copied', {
        productId: selected?.id,
        category: selected?.category,
        meta: { sku: selected?.sku, source: 'detail' }
      });
    } catch {
      window.prompt('Copy your order text:', message);
    }
  };

  const openWhatsapp = () => {
    trackShopEvent('whatsapp_click', {
      productId: selected?.id,
      category: selected?.category,
      meta: { sku: selected?.sku, size: selected?.size || 'one-size', source: 'detail', reference: orderReference }
    });
  };

  const trackRecommendation = (product) => {
    trackShopEvent('product_open', {
      productId: product.id,
      category: product.category,
      meta: { sku: product.sku, source: 'recommendation' }
    });
  };

  if (!detail || !selected) {
    return (
      <section className="shop-panel shop-empty pdp-empty">
        <span className="shop-empty-icon" aria-hidden="true">👟</span>
        <h1>{error ? 'Pair not found' : 'Loading this pair…'}</h1>
        <p>{error || 'Fetching the latest Sneakwise size and price information.'}</p>
        <a className="btn btn-primary" href="/shop">Back to sneakers</a>
      </section>
    );
  }

  const guide = detail.sizeGuide;
  const saved = isWishlisted(selected.id);

  return (
    <div className="shop-page pdp-page">
      <nav className="pdp-breadcrumb" aria-label="Breadcrumb">
        <a href="/shop">Shop</a>
        <span aria-hidden="true">/</span>
        <span>{selected.categoryLabel}</span>
        <span aria-hidden="true">/</span>
        <strong>{selected.name}</strong>
      </nav>

      <div className="pdp-grid">
        <section className="pdp-media-panel">
          {selected.imageUrl && !imageFailed ? (
            <img src={selected.imageUrl} alt={selected.name} onError={() => setImageFailed(true)} />
          ) : (
            <div className="pdp-placeholder" aria-hidden="true">👟</div>
          )}
          <span className={`shop-stock${selected.available ? '' : ' out'}`}>{stockLabel(selected)}</span>
          <div className="pdp-media-caption">
            <span>Sneakwise · Ghana</span>
            <small>Exact pair, exact size — confirmed on WhatsApp</small>
          </div>
        </section>

        <section className="pdp-detail-panel">
          <div className="pdp-heading">
            <span className="shop-eyebrow">{selected.categoryLabel}</span>
            <h1>{selected.name}</h1>
            <p className="pdp-lede">
              Pick your size, add it to your bag or send this exact pair straight to Sneakwise on WhatsApp.
              No account and no online payment needed.
            </p>
          </div>

          <div className="pdp-price-row">
            <strong className="pdp-price">{money(selected.price)}</strong>
            <button
              type="button"
              className={`pdp-save${saved ? ' active' : ''}`}
              onClick={() => toggleWishlist(selected.id)}
              aria-pressed={saved}
            >
              {saved ? '♥ Saved' : '♡ Save pair'}
            </button>
          </div>

          {variants.length > 1 && (
            <div className="pdp-section">
              <div className="pdp-section-label">Choose {selected.sizeLabel || 'size'}</div>
              <div className="shop-size-pills" role="radiogroup" aria-label="Select size">
                {variants.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    role="radio"
                    aria-checked={variant.id === selectedId}
                    className={`shop-size-pill${variant.id === selectedId ? ' active' : ''}${!variant.available ? ' out' : ''}`}
                    onClick={() => setSelectedId(variant.id)}
                  >
                    <span>{variant.size || 'One size'}</span>
                    {!variant.available && <small>Sold out</small>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pdp-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setAdded(addToCart(selected))}
              disabled={!selected.available}
            >
              {!selected.available ? 'Sold out' : added ? 'Added to bag ✓' : 'Add to bag'}
            </button>
            {selected.available && whatsappUrl ? (
              <a className="btn shop-wa" href={whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={openWhatsapp}>
                Order on WhatsApp
              </a>
            ) : selected.available ? (
              <button type="button" className="btn shop-wa" onClick={copyOrder}>
                {copied ? 'Order copied ✓' : 'Copy order text'}
              </button>
            ) : null}
            <a className="btn btn-ghost" href="/shop/cart">View bag</a>
          </div>

          <div className="pdp-specs">
            <div><span>Style code</span><strong>{selected.sku}</strong></div>
            <div><span>Category</span><strong>{selected.categoryLabel}</strong></div>
            <div><span>{selected.sizeLabel || 'Size'}</span><strong>{selected.size || 'One size'}</strong></div>
            <div><span>Availability</span><strong>{stockLabel(selected)}</strong></div>
          </div>

          <div className="shop-trust pdp-trust">
            <div><strong>Confirmed on WhatsApp</strong><span>Stock and delivery are agreed before payment</span></div>
            <div><strong>Preferences, not charges</strong><span>Delivery and payment choices are discussed in chat</span></div>
            <div><strong>Staff records the sale</strong><span>No POS sale is created by this page</span></div>
          </div>

          <div className="pdp-preferences">
            <span><small>Delivery choices</small>{detail.deliveryOptions?.slice(0, 2).join(' · ') || 'Confirmed on WhatsApp'}</span>
            <span><small>Payment choices</small>{detail.paymentOptions?.slice(0, 2).join(' · ') || 'Confirmed on WhatsApp'}</span>
          </div>

          {guide?.rows?.length ? (
            <details className="shop-size-guide pdp-guide" onToggle={(event) => {
              if (event.currentTarget.open) {
                trackShopEvent('size_guide_open', {
                  productId: selected.id,
                  category: selected.category,
                  meta: { sku: selected.sku, source: 'detail' }
                });
              }
            }}>
              <summary>{guide.title || 'Sneaker size guide'}</summary>
              <p className="muted">{guide.note}</p>
              <div className="shop-size-guide-table">
                <table>
                  <thead><tr>{(guide.columns || []).map((column) => <th key={column}>{column}</th>)}</tr></thead>
                  <tbody>
                    {guide.rows.map((row, index) => (
                      <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ) : null}

          <p className="muted pdp-ref">WhatsApp reference: <strong>{orderReference || '—'}</strong></p>

          <details className="shop-message-preview">
            <summary>Preview WhatsApp message</summary>
            <pre>{message}</pre>
          </details>
        </section>
      </div>

      {detail.recommendations?.length ? (
        <section className="pdp-recommendations">
          <div className="pdp-section-head">
            <div>
              <span className="shop-eyebrow">More pairs</span>
              <h2>You may also like</h2>
            </div>
            <a href="/shop">See all sneakers ↗</a>
          </div>
          <div className="pdp-rec-grid">
            {detail.recommendations.map((product) => (
              <a
                key={product.id}
                className="pdp-rec-card"
                href={`/shop/product/${product.id}`}
                onClick={() => trackRecommendation(product)}
              >
                <div className="pdp-rec-media">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} loading="lazy" />
                  ) : (
                    <span aria-hidden="true">👟</span>
                  )}
                  <small className={product.available ? '' : 'out'}>{stockLabel(product)}</small>
                </div>
                <div className="pdp-rec-body">
                  <span>{product.categoryLabel}</span>
                  <strong>{product.name}</strong>
                  <small>{product.size ? `${product.sizeLabel}: ${product.size}` : 'One size'}</small>
                  <div><b>{money(product.price)}</b><span>View pair ↗</span></div>
                </div>
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
