'use client';

import { useStorefront } from './StorefrontProvider';

export default function StorefrontHeader() {
  const { wishlist } = useStorefront();

  return (
    <header className="shop-topbar">
      <a className="shop-brand" href="/shop" aria-label="Sneakwise home">
        <span>SNEAKWISE</span>
        <small>Sneaker boutique</small>
      </a>
      <nav className="shop-nav" aria-label="Storefront">
        <a href="/shop">Shop</a>
        <a href="/shop/wishlist">
          Wishlist{wishlist.length > 0 ? <span className="shop-count">{wishlist.length}</span> : null}
        </a>
      </nav>
    </header>
  );
}
