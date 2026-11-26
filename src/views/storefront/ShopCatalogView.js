'use client';

import { useMemo, useState } from 'react';
import { useStorefront } from './StorefrontProvider';
import ProductCard from './ProductCard';

export default function ShopCatalogView() {
  const { catalog, loading, error } = useStorefront();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [size, setSize] = useState('all');
  const [sort, setSort] = useState('featured');

  const categories = useMemo(() => {
    const used = new Set(catalog.products.map((product) => product.category));
    return catalog.categories.filter((item) => used.has(item.id));
  }, [catalog]);

  const sizes = useMemo(() => {
    const rows = category === 'all'
      ? catalog.products
      : catalog.products.filter((product) => product.category === category);
    return [...new Set(rows.map((product) => product.size).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [catalog.products, category]);

  const products = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = catalog.products.filter((product) => {
      if (category !== 'all' && product.category !== category) return false;
      if (size !== 'all' && product.size !== size) return false;
      if (!q) return true;
      return [product.name, product.sku, product.categoryLabel, product.size]
        .some((value) => String(value || '').toLowerCase().includes(q));
    });
    if (sort === 'price-asc') return [...rows].sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') return [...rows].sort((a, b) => b.price - a.price);
    return rows;
  }, [catalog.products, search, category, size, sort]);

  const selectCategory = (id) => {
    setCategory(id);
    setSize('all');
  };

  return (
    <div className="shop-page">
      <section className="shop-hero">
        <div>
          <span className="shop-eyebrow">Sneakwise · Ghana</span>
          <h1>Fresh pairs. Straight to your WhatsApp.</h1>
          <p>
            Browse the latest sneakers and slides. Choose your size,
            build a bag and send your order in one tap — no account needed.
          </p>
          <div className="shop-hero-actions">
            <a className="btn btn-primary" href="#pairs">Shop the collection</a>
            <a className="btn btn-secondary" href="/shop/cart">View bag</a>
          </div>
        </div>
        <div className="shop-hero-art" aria-hidden="true">
          <span>👟</span>
          <small>Walk in style</small>
        </div>
      </section>

      <section className="shop-filters" id="pairs" aria-label="Product filters">
        <div className="shop-filter-row">
          <input
            className="input"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by model or code"
            aria-label="Search products"
          />
          <select
            className="input"
            value={size}
            onChange={(event) => setSize(event.target.value)}
            aria-label="Filter by size"
          >
            <option value="all">All sizes</option>
            {sizes.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select
            className="input"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            aria-label="Sort products"
          >
            <option value="featured">Featured</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>
        </div>
        <div className="shop-chips" role="group" aria-label="Categories">
          <button
            type="button"
            className={category === 'all' ? 'active' : ''}
            onClick={() => selectCategory('all')}
          >
            All pairs
          </button>
          {categories.map((item) => (
            <button
              key={item.id}
              type="button"
              className={category === item.id ? 'active' : ''}
              onClick={() => selectCategory(item.id)}
            >
              {item.name}
            </button>
          ))}
        </div>
      </section>

      <div className="shop-result-line">
        <strong>{loading ? 'Loading pairs…' : `${products.length} ${products.length === 1 ? 'pair' : 'pairs'}`}</strong>
        <span>Prices in GH₵ · availability confirmed on WhatsApp</span>
      </div>

      {error ? <div className="alert alert-error" role="status">{error}</div> : null}

      {!loading && products.length === 0 ? (
        <div className="shop-empty">
          <strong>No pairs found</strong>
          <p>Try another size or clear your search.</p>
          <button type="button" className="btn btn-secondary" onClick={() => { setSearch(''); setCategory('all'); setSize('all'); }}>
            Clear filters
          </button>
        </div>
      ) : (
        <section className="shop-product-grid" aria-label="Products">
          {(loading ? Array.from({ length: 6 }) : products).map((product, index) => product
            ? <ProductCard key={product.id} product={product} />
            : <div className="shop-product shop-skeleton" key={`skeleton-${index}`} />)}
        </section>
      )}
    </div>
  );
}
