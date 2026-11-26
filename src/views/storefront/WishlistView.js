'use client';

import { useStorefront } from './StorefrontProvider';
import ProductCard from './ProductCard';

export default function WishlistView() {
  const { catalog, wishlist, loading } = useStorefront();
  const saved = catalog.products.filter((product) => wishlist.includes(product.id));

  if (!loading && saved.length === 0) {
    return (
      <section className="shop-panel shop-empty">
        <span className="shop-empty-icon" aria-hidden="true">♡</span>
        <h1>No saved pairs yet</h1>
        <p>Tap the heart on any sneaker to keep it here for later.</p>
        <a className="btn btn-primary" href="/shop">Find your pair</a>
      </section>
    );
  }

  return (
    <div className="shop-page">
      <div className="shop-page-head">
        <div>
          <span className="shop-eyebrow">Saved for later</span>
          <h1>Your wishlist</h1>
        </div>
        <span className="muted">{saved.length} {saved.length === 1 ? 'pair' : 'pairs'}</span>
      </div>
      <section className="shop-product-grid" aria-label="Wishlist">
        {saved.map((product) => <ProductCard key={product.id} product={product} />)}
      </section>
    </div>
  );
}
