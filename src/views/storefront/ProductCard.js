'use client';

import { useEffect, useState } from 'react';
import { useStorefront } from './StorefrontProvider';
import { money } from '../../viewmodels/storefront/whatsapp';

export default function ProductCard({ product }) {
  const { addToCart, toggleWishlist, isWishlisted } = useStorefront();
  const [added, setAdded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const saved = isWishlisted(product.id);

  useEffect(() => {
    if (!added) return undefined;
    const timer = window.setTimeout(() => setAdded(false), 1400);
    return () => window.clearTimeout(timer);
  }, [added]);

  const stockLabel = !product.available
    ? 'Sold out'
    : product.units <= 3
      ? `Only ${product.units} left`
      : 'Available';

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
          <button
            type="button"
            className="btn btn-primary shop-add"
            onClick={() => setAdded(addToCart(product))}
            disabled={!product.available}
          >
            {!product.available ? 'Sold out' : added ? 'Added ✓' : 'Add to bag'}
          </button>
        </div>
      </div>
    </article>
  );
}
