'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStorefront } from './StorefrontProvider';
import { buildProductMessage, buildWhatsappUrl, money } from '../../viewmodels/storefront/whatsapp';

export default function ProductCard({ product }) {
  const { catalog, addToCart, toggleWishlist, isWishlisted } = useStorefront();
  const [added, setAdded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const saved = isWishlisted(product.id);

  const orderMessage = useMemo(
    () => buildProductMessage({ companyName: catalog.companyName, product }),
    [catalog.companyName, product]
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
    } catch {
      window.prompt('Copy your order text:', orderMessage);
    }
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
    >
      Order on WhatsApp
    </a>
  ) : (
    <button
      type="button"
      className="btn shop-wa"
      onClick={copyOrder}
      aria-label={`Copy order text for ${product.name}`}
    >
      {copied ? 'Order copied ✓' : 'Copy order text'}
    </button>
  );

  return (
    <article className="shop-product">
      <div className="shop-product-media">
        {product.imageUrl && !imageFailed ? (
          <img src={product.imageUrl} alt={product.name} onError={() => setImageFailed(true)} />
        ) : (
          <div className="shop-product-placeholder" aria-hidden="true">👟</div>
        )}
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
        <h3>{product.name}</h3>
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
  );
}
