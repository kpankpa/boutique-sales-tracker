'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStorefront } from './StorefrontProvider';
import { buildProductMessage, buildWhatsappUrl, money } from '../../viewmodels/storefront/whatsapp';
import { trackShopEvent } from '../../viewmodels/storefront/analytics';

export default function ProductDetailDrawer({ product, onClose }) {
  const { catalog, addToCart, orderReference } = useStorefront();
  const [imageFailed, setImageFailed] = useState(false);
  const [added, setAdded] = useState(false);
  const [copied, setCopied] = useState(false);

  const variants = useMemo(() => catalog.products
    .filter((row) => row.name === product.name && row.category === product.category)
    .sort((a, b) => String(a.size || '').localeCompare(String(b.size || ''), undefined, { numeric: true })),
  [catalog.products, product.name, product.category]);

  const [selectedId, setSelectedId] = useState(product.id);
  useEffect(() => { setSelectedId(product.id); }, [product.id]);
  const selected = variants.find((row) => row.id === selectedId) || product;

  useEffect(() => {
    trackShopEvent('product_open', {
      productId: selected.id,
      category: selected.category,
      meta: { sku: selected.sku, source: 'drawer' }
    });
  }, [selected.id, selected.category, selected.sku]);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!added && !copied) return undefined;
    const timer = window.setTimeout(() => { setAdded(false); setCopied(false); }, 1600);
    return () => window.clearTimeout(timer);
  }, [added, copied]);

  const orderMessage = useMemo(
    () => buildProductMessage({ companyName: catalog.companyName, product: selected, reference: orderReference }),
    [catalog.companyName, selected, orderReference]
  );
  const orderUrl = useMemo(
    () => buildWhatsappUrl(catalog.whatsappNumber, orderMessage),
    [catalog.whatsappNumber, orderMessage]
  );

  const copyOrder = async () => {
    try {
      await navigator.clipboard.writeText(orderMessage);
      setCopied(true);
      trackShopEvent('order_copied', { productId: selected.id, category: selected.category, meta: { sku: selected.sku, source: 'drawer' } });
    } catch {
      window.prompt('Copy your order text:', orderMessage);
    }
  };

  const openWhatsapp = () => {
    trackShopEvent('whatsapp_click', {
      productId: selected.id,
      category: selected.category,
      meta: { sku: selected.sku, source: 'drawer', reference: orderReference }
    });
  };

  const stockLabel = !selected.available
    ? 'Sold out'
    : selected.units <= 3
      ? `Only ${selected.units} left`
      : 'Available';

  return (
    <div className="shop-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside className="shop-drawer" role="dialog" aria-modal="true" aria-label={selected.name} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="shop-drawer-close" onClick={onClose} aria-label="Close">×</button>
        <div className="shop-drawer-media">
          {selected.imageUrl && !imageFailed ? (
            <img src={selected.imageUrl} alt={selected.name} onError={() => setImageFailed(true)} />
          ) : (
            <div className="shop-product-placeholder" aria-hidden="true">👟</div>
          )}
          <span className={`shop-stock${selected.available ? '' : ' out'}`}>{stockLabel}</span>
        </div>

        <div className="shop-drawer-body">
          <span className="shop-eyebrow">{selected.categoryLabel}</span>
          <h2>{selected.name}</h2>
          <div className="shop-drawer-price-row">
            <strong className="shop-drawer-price">{money(selected.price)}</strong>
            <span className="shop-product-code">{selected.sku}</span>
          </div>

          {variants.length > 1 && (
            <div className="shop-drawer-section">
              <div className="shop-drawer-label">Select {selected.sizeLabel || 'size'}</div>
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

          <div className="shop-drawer-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setAdded(addToCart(selected))}
              disabled={!selected.available}
            >
              {!selected.available ? 'Sold out' : added ? 'Added ✓' : 'Add to bag'}
            </button>
            {selected.available && orderUrl ? (
              <a className="btn shop-wa" href={orderUrl} target="_blank" rel="noopener noreferrer" onClick={openWhatsapp}>
                Order on WhatsApp
              </a>
            ) : selected.available ? (
              <button type="button" className="btn shop-wa" onClick={copyOrder}>{copied ? 'Order copied ✓' : 'Copy order text'}</button>
            ) : null}
          </div>

          <a className="pdp-full-link" href={`/shop/product/${selected.id}`}>
            View full details &amp; recommended pairs ↗
          </a>

          <div className="shop-drawer-section shop-trust">
            <div><strong>No account needed</strong><span>Prices in GH₵</span></div>
            <div><strong>Confirmed on WhatsApp</strong><span>Stock and delivery are confirmed before payment</span></div>
            <div><strong>Staff records the sale</strong><span>POS sale is created only after confirmation</span></div>
          </div>

          {catalog.sizeGuide?.rows?.length ? (
            <details className="shop-size-guide" onToggle={(event) => {
              if (event.currentTarget.open) trackShopEvent('size_guide_open', { productId: selected.id, category: selected.category, meta: { sku: selected.sku } });
            }}>
              <summary>{catalog.sizeGuide.title || 'Size guide'}</summary>
              <p className="muted">{catalog.sizeGuide.note}</p>
              <div className="shop-size-guide-table">
                <table>
                  <thead><tr>{(catalog.sizeGuide.columns || []).map((col) => <th key={col}>{col}</th>)}</tr></thead>
                  <tbody>
                    {catalog.sizeGuide.rows.map((row, index) => (
                      <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ) : null}

          <p className="muted shop-drawer-ref">WhatsApp reference: <strong>{orderReference || '—'}</strong></p>
        </div>
      </aside>
    </div>
  );
}
