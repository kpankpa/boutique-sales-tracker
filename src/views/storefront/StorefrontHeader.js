'use client';

import { useStorefront } from './StorefrontProvider';

export default function StorefrontHeader() {
  const { cartCount, wishlist } = useStorefront();

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
        <a href="/shop/cart" className="shop-bag">
          Bag{cartCount > 0 ? <span className="shop-count">{cartCount}</span> : null}
        </a>
        <a href="/login" className="shop-staff-link">Staff</a>
      </nav>
    </header>
  );
}
