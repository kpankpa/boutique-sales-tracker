import ProductDetailView from '../../../../views/storefront/ProductDetailView';

export const metadata = { title: 'Sneaker details — Sneakwise' };

export default async function ProductPage({ params }) {
  const { id } = await params;
  return <ProductDetailView productId={id} />;
}
