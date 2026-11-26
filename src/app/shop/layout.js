import { StorefrontProvider } from '../../views/storefront/StorefrontProvider';
import StorefrontHeader from '../../views/storefront/StorefrontHeader';

export const metadata = {
  title: 'Sneakwise — Sneaker Boutique',
  description: 'Browse Sneakwise sneakers, build a bag and order on WhatsApp.'
};

export default function ShopLayout({ children }) {
  return (
    <StorefrontProvider>
      <div className="shop-shell">
        <StorefrontHeader />
        <main className="shop-main">{children}</main>
        <footer className="shop-footer">
          <span>SNEAKWISE</span>
          <span>Fresh pairs, confirmed on WhatsApp.</span>
        </footer>
      </div>
    </StorefrontProvider>
  );
}
