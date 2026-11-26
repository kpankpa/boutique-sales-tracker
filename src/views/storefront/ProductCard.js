'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStorefront } from './StorefrontProvider';
import ProductDetailDrawer from './ProductDetailDrawer';
import { buildProductMessage, buildWhatsappUrl, money } from '../../viewmodels/storefront/whatsapp';
import { trackShopEvent } from '../../viewmodels/storefront/analytics';

export default function ProductCard({ product }) {
  const { catalog, addToCart, toggleWishlist, isWishlisted, orderReference } = useStorefront();
  const [added, setAdded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const saved = isWishlisted(product.id);

  const orderMessage = useMemo(
    () => buildProductMessage({ companyName: catalog.companyName, product, reference: orderReference }),
    [catalog.companyName, product, orderReference]
  );
  const orderUrl = useMemo(
    () => buildWhatsappUrl(catalog.whatsappNumber, orderMessage),
    [catalog.whatsappNumber, orderMessage]
  );

  useEffect(() => {
    if (!added && !copied) return undefined;
    const timer = window.setTimeout(() => {
      setAdded(false);
      setCopied(false);
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [added, copied]);

  const copyOrder = async () => {
    try {
      await navigator.clipboard.writeText(orderMessage);
      setCopied(true);
      trackShopEvent('order_copied', { productId: product.id, category: product.category, meta: { sku: product.sku, source: 'card' } });
    } catch {
      window.prompt('Copy your order text:', orderMessage);
    }
  };

  const openWhatsapp = () => {
    trackShopEvent('whatsapp_click', {
      productId: product.id,
      category: product.category,
      meta: { sku: product.sku, size: product.size || 'one-size', source: 'card', reference: orderReference }
    });
  };

  const stockLabel = !product.available
    ? 'Sold out'
    : product.units <= 3
      ? `Only ${product.units} left`
      : 'Available';

  const whatsappButton = !product.available ? (
    <button type="button" className="btn shop-wa" disabled>
      Sold out
    </button>
  ) : orderUrl ? (
    <a
      className="btn shop-wa"
      href={orderUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Order ${product.name} on WhatsApp`}
      onClick={openWhatsapp}
    >
      Order on WhatsApp
    </a>
  ) : (
    <button type="button" className="btn shop-wa" onClick={copyOrder} aria-label={`Copy order text for ${product.name}`}>
      {copied ? 'Order copied ✓' : 'Copy order text'}
    </button>
  );

  return (
    <>
      <article className="shop-product">
        <div className="shop-product-media">
          {product.imageUrl && !imageFailed ? (
            <img src={product.imageUrl} alt={product.name} onError={() => setImageFailed(true)} />
          ) : (
            <div className="shop-product-placeholder" aria-hidden="true">👟</div>
          )}
          <button
            type="button"
            className="shop-media-open"
            onClick={() => setDetailsOpen(true)}
            aria-label={`View ${product.name} details and size guide`}
          >
            <span>Quick view</span>
          </button>
          <button
            type="button"
            className={`shop-heart${saved ? ' active' : ''}`}
            onClick={() => toggleWishlist(product.id)}
            aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
            aria-pressed={saved}
          >
            {saved ? '♥' : '♡'}
          </button>
          <span className={`shop-stock${product.available ? '' : ' out'}`}>{stockLabel}</span>
        </div>
        <div className="shop-product-body">
          <span className="shop-category">{product.categoryLabel}</span>
          <h3><a href={`/shop/product/${product.id}`}>{product.name}</a></h3>
          <p className="shop-size">{product.size ? `${product.sizeLabel}: ${product.size}` : 'One size'}</p>
          <div className="shop-product-foot">
            <strong>{money(product.price)}</strong>
            <span className="shop-product-code">{product.sku}</span>
          </div>
          <div className="shop-product-actions">
            <button
              type="button"
              className="btn btn-primary shop-add"
              onClick={() => setAdded(addToCart(product))}
              disabled={!product.available}
            >
              {!product.available ? 'Sold out' : added ? 'Added ✓' : 'Add to bag'}
            </button>
            {whatsappButton}
          </div>
        </div>
      </article>
      {detailsOpen && <ProductDetailDrawer product={product} onClose={() => setDetailsOpen(false)} />}
    </>
  );
}
