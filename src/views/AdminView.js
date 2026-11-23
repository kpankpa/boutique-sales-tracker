'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '../viewmodels/useSession';
import { adminTabs, useAdmin } from '../viewmodels/useAdmin';
import { productCategories as defaultCategories, categoryLabel as fallbackCategoryLabel, displayProductName } from '../models/productOptions';
import { money, dateTime } from './format';
import { Badge, Button, Card, DataTable, Field, Input, Select, Shell } from './components/ui';

const blankProduct = {
  name: '',
  category: 'clothing',
  sku: '',
  size: '',
  sizes: [],
  price: '',
  cost: '',
  openingStock: '',
  active: true
};
const blankCategory = { name: '', sizeLabel: 'Size', sizes: '', active: true };
const blankCustomer = { name: '', phone: '', email: '', consent: true, creditLimit: '', tags: '', notes: '', active: true };
const blankUser = { name: '', username: '', role: 'cashier', branchId: '', pin: '', password: '', active: true };
const blankBranch = { name: '', code: '', active: true };
const blankStock = { branchId: '', sku: '', delta: '' };

export default function AdminView() {
  const router = useRouter();
  const { user, loading, signOut, sessionExpiring } = useSession();
  const admin = useAdmin();
  const [product, setProduct] = useState(blankProduct);
  const [customSize, setCustomSize] = useState('');
  const [editingProductId, setEditingProductId] = useState(null);
  const [category, setCategory] = useState(blankCategory);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [customer, setCustomer] = useState(blankCustomer);
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [staff, setStaff] = useState(blankUser);
  const [editingUserId, setEditingUserId] = useState(null);
  const [branch, setBranch] = useState(blankBranch);
  const [editingBranchId, setEditingBranchId] = useState(null);
  const [stockAdjustment, setStockAdjustment] = useState(blankStock);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    else if (!loading && user && user.role !== 'admin') router.replace('/pos');
  }, [loading, user, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const sku = params.get('sku');
    const branchId = params.get('branchId');
    const delta = params.get('delta');
    if (sku || branchId || delta) {
      setStockAdjustment({
        branchId: branchId || '',
        sku: sku || '',
        delta: delta || ''
      });
    }
  }, []);

  if (loading || !user || user.role !== 'admin') {
    return <div className="center-screen"><p>Loading…</p></div>;
  }

  const create = async (action, payload, reset) => {
    const done = await action(payload);
    if (done) reset();
  };

  const categories = admin.categories.length > 0 ? admin.categories : defaultCategories;
  const selectedCategory = categories.find((item) => item.id === product.category)
    ?? categories[0]
    ?? defaultCategories[defaultCategories.length - 1];
  const resolveCategoryLabel = (id) => categories.find((item) => item.id === id)?.name
    ?? fallbackCategoryLabel(id);

  const toggleSize = (size) => {
    setProduct((current) => {
      const sizes = current.sizes.includes(size)
        ? current.sizes.filter((value) => value !== size)
        : [...current.sizes, size];
      return { ...current, sizes };
    });
  };

  const addCustomSize = () => {
    const size = customSize.trim();
    if (!size) return;
    setProduct((current) => (
      current.sizes.includes(size) ? current : { ...current, sizes: [...current.sizes, size] }
    ));
    setCustomSize('');
  };

  const downloadCustomers = async () => {
    const rows = await admin.exportCustomers();
    if (!rows) return;
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `customers-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const deactivateCustomer = async (row) => {
    const confirmed = window.confirm(
      `Deactivate ${row.name}? The record is kept, but it will no longer appear in the POS.`
    );
    if (confirmed) await admin.deactivateCustomer({ id: row.id });
  };

  const summaryCards = [
    { label: "Today's sales", value: admin.summary.totalSales },
    { label: "Today's total", value: money(admin.summary.totalAmount) },
    { label: 'Branches', value: admin.summary.branches.length }
  ];

  return (
    <Shell
      user={user}
      onSignOut={signOut}
      sessionExpiring={sessionExpiring}
      links={[{ href: '/pos', label: 'POS' }, { href: '/admin', label: 'Admin' }]}
    >
      <div className="page-head">
        <h1>Admin</h1>
        <nav className="tabs">
          {adminTabs.map((tab) => (
            <button key={tab} className={tab === admin.tab ? 'active' : ''} onClick={() => admin.setTab(tab)}>
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {admin.error && <div className="alert alert-error" role="alert">{admin.error}</div>}
      {admin.loading && <div className="alert alert-info">Loading…</div>}

      {admin.tab === 'Overview' && (
        <div className="stack">
          <div className="metric-grid">
            {summaryCards.map((card) => (
              <div className="metric" key={card.label}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </div>
            ))}
          </div>
          <Card title="Today by branch">
            <DataTable
              columns={[
                { key: 'name', label: 'Branch', render: (row) => row.name },
                { key: 'count', label: 'Sales', render: (row) => row.saleCount },
                { key: 'cash', label: 'Cash', render: (row) => money(row.methods.cash) },
                { key: 'momo', label: 'MoMo', render: (row) => money(row.methods.momo) },
                { key: 'amount', label: 'Total', render: (row) => money(row.amount) }
              ]}
              rows={admin.summary.branches}
              empty="No sales today."
            />
          </Card>
          <Card title="Low stock">
            <DataTable
              columns={[
                { key: 'branch', label: 'Branch', render: (row) => row.branch_name },
                { key: 'sku', label: 'Code', render: (row) => row.sku },
                { key: 'name', label: 'Item', render: (row) => displayProductName(row.name, row.size) },
                { key: 'qty', label: 'On hand', render: (row) => row.qty }
              ]}
              rows={admin.lowStock}
              empty="Nothing is below its reorder level."
            />
          </Card>
        </div>
      )}

      {admin.tab === 'Products' && (
        <div className="stack">
          <Card title={editingProductId ? 'Edit product' : 'Add product'} subtitle={editingProductId ? 'Update this variant. SKU stays the same to protect sales history.' : 'Use sizes for shoes, clothes and trousers. Each size gets its own stock record.'}>
            <form className="form-grid" onSubmit={async (event) => {
              event.preventDefault();
              if (editingProductId) {
                const done = await admin.updateProduct({
                  id: editingProductId,
                  name: product.name,
                  category: product.category,
                  size: product.size,
                  price: product.price,
                  cost: product.cost,
                  active: product.active !== false
                });
                if (done) {
                  setEditingProductId(null);
                  setProduct(blankProduct);
                  setCustomSize('');
                }
                return;
              }
              const payload = {
                name: product.name,
                category: product.category,
                price: product.price,
                cost: product.cost,
                openingStock: product.openingStock
              };
              if (product.sizes.length > 0) {
                payload.baseSku = product.sku;
                payload.sizes = product.sizes;
              } else {
                payload.sku = product.sku;
                payload.size = product.size;
              }
              create(admin.createProduct, payload, () => {
                setProduct(blankProduct);
                setCustomSize('');
              });
            }}>
              <Field label="Category">
                <Select value={product.category} onChange={(event) => setProduct({ ...product, category: event.target.value, sizes: [], size: '' })}>
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Product name"><Input value={product.name} onChange={(event) => setProduct({ ...product, name: event.target.value })} required /></Field>
              <Field label={editingProductId ? 'Item code' : (product.sizes.length > 0 ? 'Style code' : 'Item code')} hint={editingProductId ? 'SKU cannot be changed.' : (product.sizes.length > 0 ? 'Each size becomes CODE-SIZE' : 'Unique code used at the till')}>
                <Input value={product.sku} onChange={(event) => setProduct({ ...product, sku: event.target.value })} required disabled={Boolean(editingProductId)} />
              </Field>
              <Field label="Price (GH₵)"><Input type="number" min="0" step="0.01" value={product.price} onChange={(event) => setProduct({ ...product, price: event.target.value })} required /></Field>
              <Field label="Cost (GH₵)"><Input type="number" min="0" step="0.01" value={product.cost} onChange={(event) => setProduct({ ...product, cost: event.target.value })} /></Field>
              {!editingProductId && (
                <Field label="Opening stock" hint="Added to every branch, per size"><Input type="number" min="0" step="1" value={product.openingStock} onChange={(event) => setProduct({ ...product, openingStock: event.target.value })} /></Field>
              )}

              {editingProductId ? (
                <>
                  <Field label="Size"><Input value={product.size || ''} onChange={(event) => setProduct({ ...product, size: event.target.value })} placeholder="Optional" /></Field>
                  <label className="check">
                    <input type="checkbox" checked={product.active !== false} onChange={(event) => setProduct({ ...product, active: event.target.checked })} />
                    Product active
                  </label>
                </>
              ) : selectedCategory.sizes.length > 0 ? (
                <Field label={selectedCategory.sizeLabel} hint="Pick all sizes you have. You can add a custom size too.">
                  <div className="stack">
                    <div className="size-picker">
                      {selectedCategory.sizes.map((size) => (
                        <button
                          key={size}
                          type="button"
                          className={product.sizes.includes(size) ? 'size-chip active' : 'size-chip'}
                          onClick={() => toggleSize(size)}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                    <div className="row">
                      <Input value={customSize} onChange={(event) => setCustomSize(event.target.value)} placeholder="Custom size" />
                      <Button type="button" variant="secondary" onClick={addCustomSize}>Add size</Button>
                    </div>
                    {product.sizes.length > 0 && <small className="muted">Selected: {product.sizes.join(', ')}</small>}
                  </div>
                </Field>
              ) : (
                <Field label="Size (optional)" hint="Leave blank for items with no size">
                  <Input value={product.size} onChange={(event) => setProduct({ ...product, size: event.target.value })} placeholder="e.g. Free size" />
                </Field>
              )}

              <div className="row">
                <Button type="submit">{editingProductId ? 'Update product' : 'Save product'}</Button>
                {editingProductId && <Button type="button" variant="ghost" onClick={() => { setEditingProductId(null); setProduct(blankProduct); setCustomSize(''); }}>Cancel</Button>}
              </div>
            </form>
          </Card>
          <Card title={editingCategoryId ? 'Edit category' : 'Add category'} subtitle="Create or update product categories and their size options.">
            <form className="form-grid" onSubmit={async (event) => {
              event.preventDefault();
              const payload = {
                name: category.name,
                sizeLabel: category.sizeLabel,
                sizes: category.sizes,
                active: category.active
              };
              if (editingCategoryId) {
                const done = await admin.updateCategory({ ...payload, id: editingCategoryId });
                if (done) {
                  setEditingCategoryId(null);
                  setCategory(blankCategory);
                }
              } else {
                create(admin.createCategory, payload, () => setCategory(blankCategory));
              }
            }}>
              <Field label="Category name"><Input value={category.name} onChange={(event) => setCategory({ ...category, name: event.target.value })} required /></Field>
              <Field label="Size label" hint="Example: Shoe size, Waist size, Size"><Input value={category.sizeLabel} onChange={(event) => setCategory({ ...category, sizeLabel: event.target.value })} /></Field>
              <Field label="Sizes" hint="Comma-separated. Leave blank for no-size items."><Input value={category.sizes} onChange={(event) => setCategory({ ...category, sizes: event.target.value })} placeholder="e.g. 38, 39, 40 or S, M, L" /></Field>
              {editingCategoryId && (
                <label className="check">
                  <input type="checkbox" checked={category.active !== false} onChange={(event) => setCategory({ ...category, active: event.target.checked })} />
                  Category active
                </label>
              )}
              <div className="row">
                <Button type="submit">{editingCategoryId ? 'Update category' : 'Save category'}</Button>
                {editingCategoryId && <Button type="button" variant="ghost" onClick={() => { setEditingCategoryId(null); setCategory(blankCategory); }}>Cancel</Button>}
              </div>
            </form>
          </Card>
          <Card title="Categories">
            <DataTable
              columns={[
                { key: 'name', label: 'Name', render: (row) => row.name },
                { key: 'sizes', label: 'Sizes', render: (row) => row.sizes?.length ? row.sizes.join(', ') : 'No size' },
                { key: 'status', label: 'Status', render: (row) => row.active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge> },
                { key: 'action', label: '', render: (row) => (
                  <div className="row">
                    <Button variant="ghost" onClick={() => {
                      setEditingCategoryId(row.id);
                      setCategory({
                        name: row.name,
                        sizeLabel: row.sizeLabel || 'Size',
                        sizes: Array.isArray(row.sizes) ? row.sizes.join(', ') : '',
                        active: Boolean(row.active)
                      });
                    }}>Edit</Button>
                    <Button variant="ghost" onClick={() => admin.updateCategory({
                      id: row.id,
                      name: row.name,
                      sizeLabel: row.sizeLabel || 'Size',
                      sizes: Array.isArray(row.sizes) ? row.sizes : [],
                      active: !row.active
                    })}>{row.active ? 'Deactivate' : 'Activate'}</Button>
                  </div>
                ) }
              ]}
              rows={categories}
              empty="No categories yet."
            />
          </Card>
          <Card title="Products">
            <DataTable
              columns={[
                { key: 'sku', label: 'Code', render: (row) => row.sku },
                { key: 'name', label: 'Name', render: (row) => displayProductName(row.name, row.size) },
                { key: 'category', label: 'Category', render: (row) => resolveCategoryLabel(row.category) },
                { key: 'price', label: 'Price', render: (row) => money(row.price) },
                { key: 'status', label: 'Status', render: (row) => row.active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge> },
                { key: 'action', label: '', render: (row) => (
                  <div className="row">
                    <Button variant="ghost" onClick={() => {
                      setEditingProductId(row.id);
                      setProduct({
                        name: row.name,
                        category: row.category || 'other',
                        sku: row.sku,
                        size: row.size || '',
                        sizes: [],
                        price: String(row.price ?? ''),
                        cost: String(row.cost ?? ''),
                        openingStock: '',
                        active: Boolean(row.active)
                      });
                    }}>Edit</Button>
                    <Button variant="ghost" onClick={() => admin.updateProduct({
                      id: row.id,
                      name: row.name,
                      category: row.category || 'other',
                      size: row.size,
                      price: row.price,
                      cost: row.cost,
                      active: !row.active
                    })}>{row.active ? 'Deactivate' : 'Activate'}</Button>
                  </div>
                ) }
              ]}
              rows={admin.products}
              empty="No products yet."
            />
          </Card>
        </div>
      )}

      {admin.tab === 'Stock' && (
        <div className="stack">
          <Card title="Adjust stock" subtitle="Positive for a delivery or stock count; negative for a write-off.">
            <form className="form-grid" onSubmit={(event) => {
              event.preventDefault();
              create(admin.adjustStock, stockAdjustment, () => setStockAdjustment(blankStock));
            }}>
              <Field label="Branch">
                <Select value={stockAdjustment.branchId} onChange={(event) => setStockAdjustment({ ...stockAdjustment, branchId: event.target.value })} required>
                  <option value="">Select branch</option>
                  {admin.branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </Select>
              </Field>
              <Field label="Item">
                <Select value={stockAdjustment.sku} onChange={(event) => setStockAdjustment({ ...stockAdjustment, sku: event.target.value })} required>
                  <option value="">Select item</option>
                  {admin.products.map((item) => <option key={item.id} value={item.sku}>{displayProductName(item.name, item.size)} ({item.sku})</option>)}
                </Select>
              </Field>
              <Field label="Change" hint="For example 12 or -3">
                <Input type="number" step="any" value={stockAdjustment.delta} onChange={(event) => setStockAdjustment({ ...stockAdjustment, delta: event.target.value })} required />
              </Field>
              <Button type="submit">Adjust stock</Button>
            </form>
          </Card>
          <Card title="Stock on hand" subtitle="Every item with a stock record, by branch.">
            <DataTable
              columns={[
                { key: 'branch', label: 'Branch', render: (row) => row.branch_name },
                { key: 'sku', label: 'Code', render: (row) => row.sku },
                { key: 'name', label: 'Item', render: (row) => displayProductName(row.product_name, row.size) },
                { key: 'qty', label: 'On hand', render: (row) => row.qty },
                { key: 'low', label: 'Reorder at', render: (row) => row.low_at },
                { key: 'state', label: 'State', render: (row) => row.qty <= row.low_at
                  ? <Badge tone="warning">Low</Badge>
                  : <Badge tone="success">OK</Badge> }
              ]}
              rows={admin.stock}
              empty="No stock records yet."
            />
          </Card>
        </div>
      )}

      {admin.tab === 'Customers' && (
        <div className="stack">
          <Card title={editingCustomerId ? 'Edit customer' : 'Add customer'}>
            <form className="form-grid" onSubmit={async (event) => {
              event.preventDefault();
              if (editingCustomerId) {
                const done = await admin.updateCustomer({ ...customer, id: editingCustomerId });
                if (done) {
                  setEditingCustomerId(null);
                  setCustomer(blankCustomer);
                }
              } else {
                create(admin.createCustomer, customer, () => setCustomer(blankCustomer));
              }
            }}>
              <Field label="Name"><Input value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} required /></Field>
              <Field label="Phone"><Input value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} /></Field>
              <Field label="Email"><Input value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} /></Field>
              <Field label="Credit limit (GH₵)"><Input type="number" min="0" step="0.01" value={customer.creditLimit} onChange={(event) => setCustomer({ ...customer, creditLimit: event.target.value })} /></Field>
              {!editingCustomerId ? (
                <>
                  <label className="check">
                    <input type="checkbox" checked={customer.consent} onChange={(event) => setCustomer({ ...customer, consent: event.target.checked })} />
                    Customer agrees that we may keep these details
                  </label>
                  <p className="muted">
                    We keep these details to record purchases and credit. We do not send marketing.
                    Customers can ask for a copy or deletion at the counter.
                  </p>
                </>
              ) : (
                <label className="check">
                  <input type="checkbox" checked={customer.active !== false} onChange={(event) => setCustomer({ ...customer, active: event.target.checked })} />
                  Customer active
                </label>
              )}
              <div className="row">
                <Button type="submit">{editingCustomerId ? 'Update customer' : 'Save customer'}</Button>
                {editingCustomerId && <Button type="button" variant="ghost" onClick={() => { setEditingCustomerId(null); setCustomer(blankCustomer); }}>Cancel</Button>}
              </div>
            </form>
          </Card>
          <Card title="Customers" actions={<Button variant="secondary" onClick={downloadCustomers}>Export JSON</Button>}>
            <DataTable
              columns={[
                { key: 'name', label: 'Name', render: (row) => row.name },
                { key: 'phone', label: 'Phone', render: (row) => row.phone || '—' },
                { key: 'email', label: 'Email', render: (row) => row.email || '—' },
                { key: 'status', label: 'Status', render: (row) => row.active === 0 ? <Badge>Inactive</Badge> : <Badge tone="success">Active</Badge> },
                { key: 'action', label: '', render: (row) => (
                  <div className="row">
                    <Button variant="ghost" onClick={() => {
                      setEditingCustomerId(row.id);
                      setCustomer({
                        name: row.name || '',
                        phone: row.phone || '',
                        email: row.email || '',
                        consent: Boolean(row.consent_at),
                        creditLimit: row.credit_limit ?? '',
                        tags: row.tags || '',
                        notes: row.notes || '',
                        active: row.active !== 0
                      });
                    }}>Edit</Button>
                    <Button variant="ghost" onClick={() => admin.updateCustomer({
                      id: row.id,
                      name: row.name,
                      phone: row.phone,
                      email: row.email,
                      tags: row.tags,
                      notes: row.notes,
                      creditLimit: row.credit_limit ?? 0,
                      active: row.active === 0
                    })}>{row.active === 0 ? 'Activate' : 'Deactivate'}</Button>
                  </div>
                ) }
              ]}
              rows={admin.customers}
              empty="No customers yet."
            />
          </Card>
        </div>
      )}

      {admin.tab === 'Sales' && (
        <Card title="All sales">
          <DataTable
            columns={[
              { key: 'receipt', label: 'Receipt', render: (row) => row.receipt_no },
              { key: 'time', label: 'Time', render: (row) => dateTime(row.created_at) },
              { key: 'branch', label: 'Branch', render: (row) => row.branch_name },
              { key: 'cashier', label: 'Cashier', render: (row) => row.cashier_name },
              { key: 'payment', label: 'Payment', render: (row) => row.payment_method },
              { key: 'total', label: 'Total', render: (row) => money(row.total) }
            ]}
            rows={admin.sales}
            empty="No sales recorded."
          />
        </Card>
      )}

      {admin.tab === 'Staff' && (
        <div className="stack">
          <Card title={editingUserId ? 'Edit staff' : 'Add staff'}>
            <form className="form-grid" onSubmit={async (event) => {
              event.preventDefault();
              if (editingUserId) {
                const done = await admin.updateUser({ ...staff, id: editingUserId });
                if (done) {
                  setEditingUserId(null);
                  setStaff(blankUser);
                }
              } else {
                create(admin.createUser, staff, () => setStaff(blankUser));
              }
            }}>
              <Field label="Name"><Input value={staff.name} onChange={(event) => setStaff({ ...staff, name: event.target.value })} required /></Field>
              <Field label="Username"><Input value={staff.username} onChange={(event) => setStaff({ ...staff, username: event.target.value })} required /></Field>
              <Field label="Role">
                <Select value={staff.role} onChange={(event) => setStaff({ ...staff, role: event.target.value })}>
                  <option value="cashier">Cashier</option>
                  <option value="admin">Admin</option>
                </Select>
              </Field>
              <Field label="Branch">
                <Select value={staff.branchId} onChange={(event) => setStaff({ ...staff, branchId: event.target.value })}>
                  <option value="">Select branch</option>
                  {admin.branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </Select>
              </Field>
              <Field label="PIN (cashiers)" hint={editingUserId ? 'Leave blank to keep current PIN' : ''}><Input value={staff.pin} onChange={(event) => setStaff({ ...staff, pin: event.target.value })} /></Field>
              <Field label={editingUserId ? 'New password (optional)' : 'Password (optional)'} hint={editingUserId ? 'Leave blank to keep current password' : ''}><Input type="password" value={staff.password} onChange={(event) => setStaff({ ...staff, password: event.target.value })} /></Field>
              {editingUserId && (
                <label className="check">
                  <input type="checkbox" checked={staff.active !== false} onChange={(event) => setStaff({ ...staff, active: event.target.checked })} />
                  Staff active
                </label>
              )}
              <div className="row">
                <Button type="submit">{editingUserId ? 'Update staff' : 'Save staff'}</Button>
                {editingUserId && <Button type="button" variant="ghost" onClick={() => { setEditingUserId(null); setStaff(blankUser); }}>Cancel</Button>}
              </div>
            </form>
          </Card>
          <Card title="Staff">
            <DataTable
              columns={[
                { key: 'name', label: 'Name', render: (row) => row.name },
                { key: 'username', label: 'Username', render: (row) => row.username },
                { key: 'role', label: 'Role', render: (row) => <Badge>{row.role}</Badge> },
                { key: 'branch', label: 'Branch', render: (row) => admin.branches.find((b) => b.id === row.branch_id)?.name || 'All' },
                { key: 'status', label: 'Status', render: (row) => row.active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge> },
                { key: 'action', label: '', render: (row) => (
                  <div className="row">
                    <Button variant="ghost" onClick={() => {
                      setEditingUserId(row.id);
                      setStaff({
                        name: row.name || '',
                        username: row.username || '',
                        role: row.role || 'cashier',
                        branchId: row.branch_id ? String(row.branch_id) : '',
                        pin: '',
                        password: '',
                        active: Boolean(row.active)
                      });
                    }}>Edit</Button>
                    <Button variant="ghost" onClick={() => admin.updateUser({
                      id: row.id,
                      name: row.name,
                      username: row.username,
                      role: row.role,
                      branchId: row.branch_id,
                      active: !row.active
                    })}>{row.active ? 'Deactivate' : 'Activate'}</Button>
                  </div>
                ) }
              ]}
              rows={admin.users}
              empty="No staff yet."
            />
          </Card>
        </div>
      )}

      {admin.tab === 'Branches' && (
        <div className="stack">
          <Card title={editingBranchId ? 'Edit branch' : 'Add branch'}>
            <form className="form-grid" onSubmit={async (event) => {
              event.preventDefault();
              if (editingBranchId) {
                const done = await admin.updateBranch({ ...branch, id: editingBranchId });
                if (done) {
                  setEditingBranchId(null);
                  setBranch(blankBranch);
                }
              } else {
                create(admin.createBranch, branch, () => setBranch(blankBranch));
              }
            }}>
              <Field label="Name"><Input value={branch.name} onChange={(event) => setBranch({ ...branch, name: event.target.value })} required /></Field>
              <Field label="Code"><Input value={branch.code} onChange={(event) => setBranch({ ...branch, code: event.target.value })} /></Field>
              {editingBranchId && (
                <label className="check">
                  <input type="checkbox" checked={branch.active} onChange={(event) => setBranch({ ...branch, active: event.target.checked })} />
                  Branch active
                </label>
              )}
              <div className="row">
                <Button type="submit">{editingBranchId ? 'Update branch' : 'Save branch'}</Button>
                {editingBranchId && <Button type="button" variant="ghost" onClick={() => { setEditingBranchId(null); setBranch(blankBranch); }}>Cancel</Button>}
              </div>
            </form>
          </Card>
          <Card title="Branches">
            <DataTable
              columns={[
                { key: 'name', label: 'Name', render: (row) => row.name },
                { key: 'code', label: 'Code', render: (row) => row.code },
                { key: 'status', label: 'Status', render: (row) => row.active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge> },
                { key: 'action', label: '', render: (row) => (
                  <Button variant="ghost" onClick={() => {
                    setEditingBranchId(row.id);
                    setBranch({ name: row.name, code: row.code, active: Boolean(row.active) });
                  }}>Edit</Button>
                ) }
              ]}
              rows={admin.branches}
              empty="No branches yet."
            />
          </Card>
        </div>
      )}

      {admin.tab === 'Outbox' && (
        <div className="stack">
          <Card title="Notification outbox" subtitle="Events waiting for the future WhatsApp/SMS worker.">
            <DataTable
              columns={[
                { key: 'id', label: 'ID', render: (row) => row.id },
                { key: 'type', label: 'Event', render: (row) => row.event_type },
                { key: 'entity', label: 'Sale', render: (row) => row.entity_id },
                { key: 'status', label: 'Status', render: (row) => <Badge tone="warning">{row.status}</Badge> },
                { key: 'created', label: 'Created', render: (row) => dateTime(row.created_at) }
              ]}
              rows={admin.outbox}
              empty="No events yet."
            />
          </Card>
          <Card title="Audit log">
            <DataTable
              columns={[
                { key: 'time', label: 'Time', render: (row) => dateTime(row.created_at) },
                { key: 'user', label: 'User', render: (row) => row.user_name || 'Installer' },
                { key: 'action', label: 'Action', render: (row) => row.action },
                { key: 'entity', label: 'Record', render: (row) => `${row.entity} #${row.entity_id}` }
              ]}
              rows={admin.audit}
              empty="No activity yet."
            />
          </Card>
        </div>
      )}
    </Shell>
  );
}
