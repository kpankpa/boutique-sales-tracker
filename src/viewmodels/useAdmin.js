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
  'Outbox',
  'Insights',
  'Shop settings'
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
  const [analytics, setAnalytics] = useState({ windowDays: 14, totals: [], topProducts: [], daily: [] });
  const [shopSettings, setShopSettings] = useState({
    companyName: '',
    whatsappNumber: '',
    deliveryOptions: [],
    paymentOptions: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const requested = new URLSearchParams(window.location.search).get('tab');
    if (requested && adminTabs.includes(requested)) setTab(requested);
  }, []);

  const load = useCallback(async (nextTab) => {
    setLoading(true);
    setError('');
    setMessage('');
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
        case 'Insights':
          setAnalytics(await apiGet('/shop/analytics?days=14'));
          break;
        case 'Shop settings':
          setShopSettings(await apiGet('/settings'));
          break;
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

  const submit = async (path, payload, successMessage = 'Saved.') => {
    setError('');
    setMessage('');
    try {
      await apiPost(path, payload);
      await load(tab);
      setMessage(successMessage);
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
    analytics,
    shopSettings,
    loading,
    error,
    message,
    createProduct: (payload) => submit('/products', payload, 'Product saved.'),
    updateProduct: (payload) => submit('/products/update', payload, 'Product updated.'),
    createCategory: (payload) => submit('/categories', payload, 'Category saved.'),
    updateCategory: (payload) => submit('/categories/update', payload, 'Category updated.'),
    createCustomer: (payload) => submit('/customers', payload, 'Customer saved.'),
    updateCustomer: (payload) => submit('/customers/update', payload, 'Customer updated.'),
    createUser: (payload) => submit('/users', payload, 'Staff saved.'),
    updateUser: (payload) => submit('/users/update', payload, 'Staff updated.'),
    createBranch: (payload) => submit('/branches', payload, 'Branch saved.'),
    updateBranch: (payload) => submit('/branches/update', payload, 'Branch updated.'),
    adjustStock: (payload) => submit('/stock', payload, 'Stock adjusted.'),
    deactivateCustomer: (payload) => submit('/customers/deactivate', payload, 'Customer deactivated.'),
    updateShopSettings: (payload) => submit('/settings/update', payload, 'Shop settings saved.'),
    exportCustomers
  };
}
