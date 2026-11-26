'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, apiPost } from './api';
import { displayProductName } from '../models/productOptions';
import {
  addQueuedSale,
  listQueuedSales,
  markConflict,
  markPending,
  markSyncing,
  prepareOutbox,
  removeQueuedSale
} from './offline/outbox';

function newReference() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function usePos() {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [sales, setSales] = useState([]);
  const [stock, setStock] = useState([]);
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customerId, setCustomerId] = useState('');
  const [discount, setDiscount] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [queue, setQueue] = useState([]);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [companyName, setCompanyName] = useState('Sneakwise POS');
  const syncRun = useRef(null);

  const load = useCallback(async () => {
    try {
      const [meta, productList, customerList, saleList, stockList] = await Promise.all([
        apiGet('/meta'),
        apiGet('/products'),
        apiGet('/customers'),
        apiGet('/sales?limit=15'),
        apiGet('/stock')
      ]);
      setBranches(meta.branches);
      setCompanyName(meta.companyName || 'Sneakwise POS');
      setProducts(productList);
      setCustomers(customerList);
      setSales(saleList);
      setStock(stockList);
    } catch (failure) {
      setError(failure.message);
    }
  }, []);

  const syncQueue = useCallback(async () => {
    if (syncRun.current) return syncRun.current;

    const run = (async () => {
      const records = await listQueuedSales();
      let synced = 0;

      for (const record of records) {
        if (record.status !== 'pending') continue;
        await markSyncing(record.id);

        try {
          await apiPost('/sales', record.payload);
          await removeQueuedSale(record.id);
          synced += 1;
        } catch (failure) {
          if (failure instanceof TypeError || failure.status === 0) {
            await markPending(record.id);
            break;
          }
          await markConflict(record.id, failure);
        }
      }

      setQueue(await listQueuedSales());
      if (synced > 0) await load();
      return synced;
    })();

    syncRun.current = run;
    try {
      return await run;
    } finally {
      syncRun.current = null;
    }
  }, [load]);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      try {
        await prepareOutbox();
        if (active) setQueue(await listQueuedSales());
        if (typeof navigator !== 'undefined' && navigator.onLine) await syncQueue();
      } catch (failure) {
        if (active) setError(failure.message);
      }
    };

    initialize();
    load();

    const goOffline = () => setOffline(true);
    const goOnline = () => {
      setOffline(false);
      syncQueue();
    };

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    if (typeof navigator !== 'undefined' && !navigator.onLine) setOffline(true);

    return () => {
      active = false;
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, [load, syncQueue]);

  const stockBySku = useMemo(() => {
    const branchId = branches[0]?.id;
    const map = {};
    for (const row of stock) {
      if (branchId != null && Number(row.branch_id) !== Number(branchId)) continue;
      map[row.sku] = row;
    }
    return map;
  }, [stock, branches]);

  const addProduct = (product) => {
    setReceipt(null);
    setCart((current) => {
      const existing = current.find((line) => line.sku === product.sku);
      if (existing) {
        return current.map((line) =>
          line.sku === product.sku ? { ...line, qty: line.qty + 1 } : line
        );
      }
      return [
        ...current,
        {
          sku: product.sku,
          name: product.name,
          size: product.size ?? null,
          price: Number(product.price),
          qty: 1
        }
      ];
    });
  };

  // Resolves a scanned/typed code: barcode first, then item code. Matches the
  // locally loaded catalogue first so scanning keeps working offline; falls
  // back to the server for items added since this page loaded.
  const addByCode = async (rawCode) => {
    const code = String(rawCode ?? '').trim().toUpperCase();
    if (!code) return null;

    let product = products.find((item) => item.barcode && String(item.barcode).toUpperCase() === code)
      ?? products.find((item) => item.sku === code);

    if (!product && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        product = await apiGet(`/lookup?code=${encodeURIComponent(code)}`);
      } catch (failure) {
        if (failure.code !== 'CODE_NOT_FOUND' && !(failure instanceof TypeError)) {
          setError(failure.message);
          return null;
        }
      }
    }

    if (!product) {
      setError(`No item matches "${code}".`);
      return null;
    }

    const record = stockBySku[product.sku];
    if (record && Number(record.qty) <= 0) {
      setError(`${displayProductName(product.name, product.size)} is out of stock.`);
      return null;
    }

    addProduct(product);
    setError('');
    return product;
  };

  const setQuantity = (sku, quantity) => {
    const qty = Number(quantity);
    setCart((current) =>
      current
        .map((line) => (line.sku === sku ? { ...line, qty: qty > 0 ? qty : 0 } : line))
        .filter((line) => line.qty > 0)
    );
  };

  const removeLine = (sku) => setCart((current) => current.filter((line) => line.sku !== sku));

  const restoreLine = (line) => {
    setReceipt(null);
    setCart((current) => {
      if (current.some((entry) => entry.sku === line.sku)) return current;
      return [...current, { ...line, qty: Number(line.qty) || 1 }];
    });
  };

  const addCustomer = async (payload) => {
    try {
      await apiPost('/customers', payload);
      await load();
      return true;
    } catch (failure) {
      setError(failure.message);
      return false;
    }
  };

  const cartTotal = useMemo(
    () => cart.reduce((sum, line) => sum + line.price * line.qty, 0),
    [cart]
  );

  const enqueue = async (payload) => {
    await addQueuedSale(payload);
    setQueue(await listQueuedSales());
  };

  const submit = async () => {
    if (cart.length === 0) {
      setError('Add at least one item to the sale.');
      return null;
    }

    const needsReference = paymentMethod === 'momo' || paymentMethod === 'card';
    const reference = transactionRef.trim();
    if (needsReference && !reference) {
      setError(paymentMethod === 'momo'
        ? 'Enter the MoMo transaction ID before completing the sale.'
        : 'Enter the card transaction ID before completing the sale.');
      return null;
    }

    const payload = {
      items: cart.map((line) => ({ sku: line.sku, qty: line.qty })),
      paymentMethod,
      customerId: customerId ? Number(customerId) : null,
      discount: Number(discount) || 0,
      branchId: branches[0]?.id ?? null,
      clientRef: newReference(),
      transactionRef: needsReference ? reference : null
    };

    setBusy(true);
    setError('');

    if (!navigator.onLine) {
      await enqueue(payload);
      setReceipt({ queued: true });
      setCart([]);
      setDiscount('');
      setTransactionRef('');
      setBusy(false);
      return { queued: true };
    }

    try {
      const result = await apiPost('/sales', payload);
      const fullReceipt = {
        ...result,
        lines: cart.map((line) => ({
          sku_snapshot: line.sku,
          name_snapshot: line.name,
          size_snapshot: line.size,
          qty: line.qty,
          unit_price: line.price,
          line_total: Number((line.price * line.qty).toFixed(2))
        })),
        subtotal: Number(cartTotal.toFixed(2)),
        discount: Number(discount) || 0,
        payment_method: paymentMethod,
        transaction_ref: result.transactionRef ?? null,
        branch_name: branches[0]?.name ?? '',
        customer_name: customers.find((entry) => String(entry.id) === String(customerId))?.name ?? '',
        created_at: new Date().toISOString()
      };
      setReceipt(fullReceipt);
      setCart([]);
      setDiscount('');
      setTransactionRef('');
      await load();
      return fullReceipt;
    } catch (failure) {
      if (failure instanceof TypeError || failure.status === 0) {
        await enqueue(payload);
        setReceipt({ queued: true });
        setCart([]);
        setDiscount('');
      setTransactionRef('');
        return { queued: true };
      }
      setError(failure.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const adjustStock = async (payload) => {
    try {
      await apiPost('/stock', payload);
      setError('');
      await load();
      return true;
    } catch (failure) {
      setError(failure.message);
      return false;
    }
  };

  const retryConflict = async (id) => {
    await markPending(id);
    setQueue(await listQueuedSales());
    if (syncRun.current) await syncRun.current;
    await syncQueue();
  };

  const voidQueuedSale = async (id) => {
    await removeQueuedSale(id);
    setQueue(await listQueuedSales());
  };

  const conflicts = queue.filter((record) => record.status === 'conflict');

  return {
    products,
    customers,
    branches,
    sales,
    stockBySku,
    companyName,
    cart,
    cartTotal,
    paymentMethod,
    customerId,
    discount,
    transactionRef,
    receipt,
    queue,
    conflicts,
    offline,
    busy,
    error,
    setPaymentMethod,
    setCustomerId,
    setDiscount,
    setTransactionRef,
    setError,
    addProduct,
    addByCode,
    setQuantity,
    removeLine,
    restoreLine,
    addCustomer,
    submit,
    syncQueue,
    adjustStock,
    retryConflict,
    voidQueuedSale
  };
}
