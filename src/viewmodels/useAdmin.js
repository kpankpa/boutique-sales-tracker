'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost } from './api';

export const adminTabs = [
  'Overview',
  'Products',
  'Stock',
  'Customers',
  'Sales',
  'Staff',
  'Branches',
  'Outbox'
];

export function useAdmin() {
  const [tab, setTab] = useState('Overview');
  const [summary, setSummary] = useState({ branches: [], totalSales: 0, totalAmount: 0 });
  const [lowStock, setLowStock] = useState([]);
  const [stock, setStock] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [outbox, setOutbox] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const requested = new URLSearchParams(window.location.search).get('tab');
    if (requested && adminTabs.includes(requested)) setTab(requested);
  }, []);

  const load = useCallback(async (nextTab) => {
    setLoading(true);
    setError('');
    try {
      switch (nextTab) {
        case 'Overview': {
          const [report, lowStockRows, recent] = await Promise.all([
            apiGet('/reports/daily'),
            apiGet('/stock/low'),
            apiGet('/sales?limit=8')
          ]);
          setSummary(report);
          setLowStock(lowStockRows);
          setSales(recent);
          break;
        }
        case 'Products': {
          const [productList, categoryList] = await Promise.all([
            apiGet('/products'),
            apiGet('/categories')
          ]);
          setProducts(productList);
          setCategories(categoryList);
          break;
        }
        case 'Stock': {
          const [stockRows, branchList, productList] = await Promise.all([
            apiGet('/stock'),
            apiGet('/branches'),
            apiGet('/products')
          ]);
          setStock(stockRows);
          setBranches(branchList);
          setProducts(productList);
          break;
        }
        case 'Customers':
          setCustomers(await apiGet('/customers'));
          break;
        case 'Sales':
          setSales(await apiGet('/sales?limit=100'));
          break;
        case 'Staff': {
          const [staff, branchList] = await Promise.all([apiGet('/users'), apiGet('/branches')]);
          setUsers(staff);
          setBranches(branchList);
          break;
        }
        case 'Branches':
          setBranches(await apiGet('/branches'));
          break;
        case 'Outbox': {
          const [events, log] = await Promise.all([apiGet('/outbox'), apiGet('/audit')]);
          setOutbox(events);
          setAudit(log);
          break;
        }
        default:
          break;
      }
    } catch (failure) {
      setError(failure.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  const submit = async (path, payload) => {
    setError('');
    try {
      await apiPost(path, payload);
      await load(tab);
      return true;
    } catch (failure) {
      setError(failure.message);
      return false;
    }
  };

  const exportCustomers = async () => {
    setError('');
    try {
      return await apiGet('/customers/export');
    } catch (failure) {
      setError(failure.message);
      return null;
    }
  };

  return {
    tab,
    setTab,
    summary,
    lowStock,
    stock,
    products,
    categories,
    customers,
    sales,
    users,
    branches,
    outbox,
    audit,
    loading,
    error,
    createProduct: (payload) => submit('/products', payload),
    updateProduct: (payload) => submit('/products/update', payload),
    createCategory: (payload) => submit('/categories', payload),
    updateCategory: (payload) => submit('/categories/update', payload),
    createCustomer: (payload) => submit('/customers', payload),
    updateCustomer: (payload) => submit('/customers/update', payload),
    createUser: (payload) => submit('/users', payload),
    updateUser: (payload) => submit('/users/update', payload),
    createBranch: (payload) => submit('/branches', payload),
    updateBranch: (payload) => submit('/branches/update', payload),
    adjustStock: (payload) => submit('/stock', payload),
    deactivateCustomer: (payload) => submit('/customers/deactivate', payload),
    exportCustomers
  };
}
