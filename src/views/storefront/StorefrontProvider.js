'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiGet } from '../../viewmodels/api';
import { cartSubtotal } from '../../viewmodels/storefront/whatsapp';
import {
  cartKey,
  readCart,
  readWishlist,
  reconcileCart,
  writeCart,
  writeWishlist
} from '../../viewmodels/storefront/storage';

const emptyCatalog = {
  companyName: 'Sneakwise',
  whatsappNumber: '',
  categories: [],
  products: []
};

const StorefrontContext = createContext(null);

export function StorefrontProvider({ children }) {
  const [catalog, setCatalog] = useState(emptyCatalog);
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCart(readCart());
    setWishlist(readWishlist());
    setHydrated(true);
  }, []);

  const applyCatalog = useCallback((data) => {
    const nextCatalog = {
      companyName: data?.companyName || 'Sneakwise',
      whatsappNumber: data?.whatsappNumber || '',
      categories: Array.isArray(data?.categories) ? data.categories : [],
      products: Array.isArray(data?.products) ? data.products : []
    };
    setCatalog(nextCatalog);
    setCart((current) => {
      const next = reconcileCart(current, nextCatalog.products);
      writeCart(next);
      return next;
    });
    return nextCatalog;
  }, []);

  const refreshCatalog = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGet('/shop/catalog');
      return applyCatalog(data);
    } catch (failure) {
      setError(failure.message || 'The catalogue could not be loaded.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [applyCatalog]);

  useEffect(() => {
    if (hydrated) refreshCatalog();
  }, [hydrated, refreshCatalog]);

  const addToCart = useCallback((product, requestedQty = 1) => {
    if (!product?.available) return false;
    const qty = Math.max(1, Number(requestedQty) || 1);
    const max = Math.max(1, Number(product.units) || 1);
    const key = cartKey(product);
    setCart((current) => {
      const existing = current.find((item) => item.key === key);
      const next = existing
        ? current.map((item) => item.key === key
          ? { ...item, qty: Math.min(item.qty + qty, max) }
          : item)
        : [...current, {
          key,
          productId: product.id,
          sku: product.sku,
          name: product.name,
          categoryLabel: product.categoryLabel,
          size: product.size,
          sizeLabel: product.sizeLabel,
          imageUrl: product.imageUrl,
          price: product.price,
          units: product.units,
          qty: Math.min(qty, max)
        }];
      const capped = next.slice(0, 30);
      writeCart(capped);
      return capped;
    });
    return true;
  }, []);

  const updateQty = useCallback((key, requestedQty) => {
    const qty = Number(requestedQty);
    setCart((current) => {
      const next = current.flatMap((item) => {
        if (item.key !== key) return [item];
        if (!Number.isFinite(qty) || qty <= 0) return [];
        return [{ ...item, qty: Math.min(Math.floor(qty), Math.max(1, item.units)) }];
      });
      writeCart(next);
      return next;
    });
  }, []);

  const removeFromCart = useCallback((key) => {
    setCart((current) => {
      const next = current.filter((item) => item.key !== key);
      writeCart(next);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    writeCart([]);
  }, []);

  const toggleWishlist = useCallback((productId) => {
    const id = Number(productId);
    if (!Number.isInteger(id) || id <= 0) return;
    setWishlist((current) => {
      const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
      writeWishlist(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    catalog,
    cart,
    wishlist,
    loading,
    error,
    refreshCatalog,
    addToCart,
    updateQty,
    removeFromCart,
    clearCart,
    toggleWishlist,
    isWishlisted: (productId) => wishlist.includes(Number(productId)),
    cartCount: cart.reduce((total, item) => total + item.qty, 0),
    subtotal: cartSubtotal(cart)
  }), [
    catalog, cart, wishlist, loading, error, refreshCatalog,
    addToCart, updateQty, removeFromCart, clearCart, toggleWishlist
  ]);

  return <StorefrontContext.Provider value={value}>{children}</StorefrontContext.Provider>;
}

export function useStorefront() {
  const context = useContext(StorefrontContext);
  if (!context) throw new Error('useStorefront must be used inside StorefrontProvider.');
  return context;
}
