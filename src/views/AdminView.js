'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '../viewmodels/useSession';
import { useBarcodeScanner } from '../viewmodels/useBarcodeScanner';
import { adminTabs, useAdmin } from '../viewmodels/useAdmin';
import { apiGet } from '../viewmodels/api';
import { productCategories as defaultCategories, categoryLabel as fallbackCategoryLabel, displayProductName } from '../models/productOptions';
import { money, dateTime } from './format';
import { Badge, Button, Card, DataTable, Field, Input, Modal, Select, Shell } from './components/ui';
import { ScannerModal } from './components/ScannerModal';
import { ReceiptModal } from './components/ReceiptModal';
import { QrCode } from './components/QrCode';
import { ImagePicker } from './components/ImagePicker';
import { Icon } from './components/Icon';
import { decodeProductQr, productQrValue } from './productQr';

const blankProduct = {
  name: '',
  category: 'shoes',
  sku: '',
  size: '',
  sizes: [],
  barcode: '',
  imageUrl: '',
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
  const [editingProductId, setEditingProductId] = useState(null);
  const [productScanStatus, setProductScanStatus] = useState('');
  const [productScanError, setProductScanError] = useState(false);
  const barcodeInputRef = useRef(null);
  const [customSize, setCustomSize] = useState('');
  const [category, setCategory] = useState(blankCategory);
  const [customer, setCustomer] = useState(blankCustomer);
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [staff, setStaff] = useState(blankUser);
  const [editingUserId, setEditingUserId] = useState(null);
  const [branch, setBranch] = useState(blankBranch);
  const [stockAdjustment, setStockAdjustment] = useState(blankStock);
  const [shopForm, setShopForm] = useState({ companyName: '', whatsappNumber: '', deliveryOptions: '', paymentOptions: '' });
  const [stockBranchId, setStockBranchId] = useState('');
  const [stockFormError, setStockFormError] = useState('');
  const [search, setSearch] = useState('');
  const [scanTarget, setScanTarget] = useState(null);
  const [labelProduct, setLabelProduct] = useState(null);
  const [showLabelSheet, setShowLabelSheet] = useState(false);
  const [showReceiptScanner, setShowReceiptScanner] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [imageError, setImageError] = useState('');

  useEffect(() => {
    setSearch('');
    setStockBranchId('');
    setStockFormError('');
  }, [admin.tab]);

  useEffect(() => {
    if (!loading && !user) router.replace('/staff');
    else if (!loading && user && user.role !== 'admin') router.replace('/staff/pos');
  }, [loading, user, router]);

  useEffect(() => {
    if (admin.shopSettings.companyName) {
      setShopForm({
        companyName: admin.shopSettings.companyName,
        whatsappNumber: admin.shopSettings.whatsappNumber || '',
        deliveryOptions: (admin.shopSettings.deliveryOptions || []).join('\n'),
        paymentOptions: (admin.shopSettings.paymentOptions || []).join('\n')
      });
    }
  }, [admin.shopSettings]);

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

  const fillProductForm = (item, mode, message) => {
    setEditingProductId(mode === 'edit' ? item.id : null);
    setProduct({
      ...blankProduct,
      sku: item.sku || '',
      name: item.name || '',
      category: item.category || 'other',
      size: item.size || '',
      barcode: item.barcode || '',
      price: item.price == null ? '' : String(item.price),
      cost: item.cost == null ? '' : String(item.cost),
      imageUrl: item.image_url ?? item.imageUrl ?? '',
      sizes: []
    });
    setCustomSize('');
    setImageError('');
    setProductScanError(false);
    setProductScanStatus(message);
  };

  async function applyProductScan(rawCode) {
    const code = String(rawCode || '').trim();
    if (!code) return;
    setProductScanStatus('');
    setProductScanError(false);

    const smart = decodeProductQr(code);
    const lookupCode = smart ? (smart.barcode || smart.sku) : code;
    if (lookupCode) {
      try {
        const found = await apiGet(`/lookup?code=${encodeURIComponent(lookupCode)}`);
        if (found?.id) {
          fillProductForm(found, 'edit', `Found ${displayProductName(found.name, found.size)} (${found.sku}). The form is now in edit mode.`);
          return;
        }
      } catch (failure) {
        if (failure.code !== 'CODE_NOT_FOUND') {
          setProductScanError(true);
          setProductScanStatus(failure.message || 'Could not look up that code.');
          if (!smart) return;
        }
      }
    }

    if (smart) {
      fillProductForm({
        sku: smart.sku,
        name: smart.name,
        category: smart.category,
        size: smart.size,
        barcode: smart.barcode,
        price: smart.price,
        cost: smart.cost
      }, 'add', 'Filled from the QR label. Check the details, then save.');
      return;
    }

    setEditingProductId(null);
    setProduct((current) => ({ ...current, barcode: code }));
    setProductScanStatus('No saved item matched that code. Barcode entered — add the details below.');
  }

  const handleHardwareScan = (code, target) => {
    const isTextInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
    if (isTextInput && target !== barcodeInputRef.current) return;
    applyProductScan(code);
  };

  useBarcodeScanner(handleHardwareScan, {
    enabled: admin.tab === 'Products' && !scanTarget && !labelProduct && !showLabelSheet && !showReceiptScanner && !receiptOpen
  });

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

  const q = search.trim().toLowerCase();
  const match = (...values) => !q || values.some((value) => String(value ?? '').toLowerCase().includes(q));
  const filteredProducts = admin.products.filter((row) => match(row.name, row.sku, row.barcode, row.category, row.size, resolveCategoryLabel(row.category)));
  const filteredCategories = categories.filter((row) => match(row.name, row.sizeLabel, ...(row.sizes || [])));
  const filteredStock = admin.stock.filter((row) => (
    (!stockBranchId || String(row.branch_id) === stockBranchId) &&
    match(row.branch_name, row.sku, row.product_name, row.size)
  ));
  // DataTable needs a stable id per row; stock is keyed by branch + product.
  const stockRows = filteredStock.map((row) => ({ ...row, id: `${row.branch_id}:${row.product_id}` }));
  const filteredCustomers = admin.customers.filter((row) => match(row.name, row.phone, row.email, row.tags));
  const filteredSales = admin.sales.filter((row) => match(row.receipt_no, row.branch_name, row.cashier_name, row.payment_method, row.transaction_ref));
  const filteredUsers = admin.users.filter((row) => match(row.name, row.username, row.role, admin.branches.find((b) => b.id === row.branch_id)?.name));
  const filteredBranches = admin.branches.filter((row) => match(row.name, row.code));
  const filteredOutbox = admin.outbox.filter((row) => match(row.event_type, row.status, row.payload));
  const filteredAudit = admin.audit.filter((row) => match(row.action, row.entity, row.actor_name, row.details));
  const analyticsByName = (name) => admin.analytics?.totals?.find((row) => row.eventName === name)?.events || 0;

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

  const openReceipt = async (receiptNo) => {
    try {
      const sale = await apiGet(`/sales/receipt?no=${encodeURIComponent(receiptNo)}`);
      setReceiptData(sale);
      setReceiptOpen(true);
    } catch (failure) {
      window.alert(failure.message || 'Receipt not found.');
    }
  };

  const deactivateCustomer = async (row) => {
    const confirmed = window.confirm(
      `Deactivate ${row.name}? The record is kept, but it will no longer appear in the POS.`
    );
    if (confirmed) await admin.deactivateCustomer({ id: row.id });
  };

  const inlineActions = (row, helpers, extra = null) => helpers.editing ? (
    <div className="row">
      <Button onClick={helpers.saveEdit} disabled={helpers.saving}>{helpers.saving ? 'Saving…' : 'Save'}</Button>
      <Button variant="ghost" onClick={helpers.cancelEdit} disabled={helpers.saving}>Cancel</Button>
    </div>
  ) : (
    <div className="row">
      <Button variant="ghost" onClick={helpers.startEdit}>Edit</Button>
      {extra}
    </div>
  );

  const stockLabel = (row) => `${displayProductName(row.product_name, row.size)} at ${row.branch_name}`;

  const stockActions = (row, helpers) => helpers.editing ? (
    <div className="stock-actions">
      <button
        type="button"
        className="icon-button icon-button-success"
        onClick={helpers.saveEdit}
        disabled={helpers.saving}
        aria-label={`Save stock for ${stockLabel(row)}`}
        title="Save new quantity"
      >
        <Icon name={helpers.saving ? 'refresh' : 'check'} size={17} className={helpers.saving ? 'spin' : ''} />
      </button>
      <button
        type="button"
        className="icon-button"
        onClick={helpers.cancelEdit}
        disabled={helpers.saving}
        aria-label="Cancel stock edit"
        title="Cancel"
      >
        <Icon name="close" size={17} />
      </button>
    </div>
  ) : (
    <div className="stock-actions">
      <button
        type="button"
        className="icon-button"
        onClick={helpers.startEdit}
        aria-label={`Edit stock on hand for ${stockLabel(row)}`}
        title="Edit stock on hand"
      >
        <Icon name="pencil" size={17} />
      </button>
    </div>
  );

  const saveStockQty = async (row, draft) => {
    const next = Number(draft.qty);
    if (!Number.isFinite(next) || next < 0) {
      setStockFormError('Enter a quantity of zero or more.');
      return false;
    }
    const current = Number(row.qty ?? 0);
    if (next === current) {
      setStockFormError('');
      return true;
    }
    const done = await admin.adjustStock({
      branchId: row.branch_id,
      sku: row.sku,
      delta: next - current
    });
    setStockFormError(done ? '' : 'Could not update stock. Please try again.');
    return done;
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
      links={[
        { href: '/staff/pos', label: 'POS' },
        { href: '/staff/admin', label: 'Admin' },
        { href: '/staff/sop', label: 'Order SOP' }
      ]}
    >
      <div className="page-head">
        <div className="row-between">
          <div>
            <p className="eyebrow">Management</p>
            <h1>Admin</h1>
          </div>
          <div className="page-search">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${admin.tab.toLowerCase()}...`}
              aria-label={`Search ${admin.tab}`}
            />
          </div>
        </div>
        <nav className="tabs" aria-label="Admin sections">
          {adminTabs.map((tab) => (
            <button key={tab} type="button" className={tab === admin.tab ? 'active' : ''} onClick={() => admin.setTab(tab)} aria-current={tab === admin.tab ? 'page' : undefined}>
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {admin.error && <div className="alert alert-error" role="alert">{admin.error}</div>}
      {admin.message && <div className="alert alert-success" role="status">{admin.message}</div>}
      {admin.loading && <div className="alert alert-info" role="status">Loading…</div>}

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
          <Card
            title={editingProductId ? 'Edit product' : 'Add product'}
            subtitle={editingProductId
              ? 'Prefilled from a scan. Change any detail and save; the item code stays the same here.'
              : 'Scan a barcode or QR label to fill the form, or type the details below.'}
            actions={editingProductId ? (
              <Button variant="ghost" onClick={() => {
                setEditingProductId(null);
                setProduct(blankProduct);
                setProductScanStatus('');
                setProductScanError(false);
              }}>
                <Icon name="plus" size={16} /> New product
              </Button>
            ) : null}
          >
            <form className="form-grid" onSubmit={async (event) => {
              event.preventDefault();
              const payload = {
                name: product.name,
                category: product.category,
                price: product.price,
                cost: product.cost,
                openingStock: product.openingStock,
                imageUrl: product.imageUrl
              };
              if (product.sizes.length > 0) {
                payload.baseSku = product.sku;
                payload.sizes = product.sizes;
              } else {
                payload.sku = product.sku;
                payload.size = product.size;
                payload.barcode = product.barcode;
              }
              const saved = editingProductId
                ? await admin.updateProduct({
                  id: editingProductId,
                  name: product.name,
                  category: product.category,
                  size: product.size,
                  barcode: product.barcode,
                  imageUrl: product.imageUrl,
                  price: product.price,
                  cost: product.cost,
                  active: true
                })
                : await admin.createProduct(payload);
              if (saved) {
                setProduct(blankProduct);
                setEditingProductId(null);
                setCustomSize('');
                setImageError('');
                setProductScanStatus('');
                setProductScanError(false);
              }
            }}>
              {productScanStatus && (
                <div className={`scan-fill-status${productScanError ? ' is-error' : ''}`} role="status">
                  <Icon name={productScanError ? 'alert' : 'check'} size={16} />
                  <span>{productScanStatus}</span>
                </div>
              )}
              <Field label="Category">
                <Select value={product.category} onChange={(event) => setProduct({ ...product, category: event.target.value, sizes: [], size: '' })}>
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Product name"><Input value={product.name} onChange={(event) => setProduct({ ...product, name: event.target.value })} required /></Field>
              <Field label={product.sizes.length > 0 ? 'Style code' : 'Item code'} hint={editingProductId ? 'Kept unchanged when editing a scanned item' : product.sizes.length > 0 ? 'Each size becomes CODE-SIZE' : 'Unique code used at the till'}>
                <Input
                  value={product.sku}
                  disabled={Boolean(editingProductId)}
                  onChange={(event) => setProduct({ ...product, sku: event.target.value })}
                  required
                />
              </Field>
              <Field
                label="Barcode (optional)"
                hint={product.sizes.length > 0
                  ? 'Multi-size styles: assign a barcode per size in the table below.'
                  : 'Manufacturer barcode (EAN/UPC). Scan it or type it.'}
              >
                <div className="row">
                  <Input
                    ref={barcodeInputRef}
                    value={product.barcode}
                    disabled={product.sizes.length > 0}
                    onChange={(event) => setProduct((current) => ({ ...current, barcode: event.target.value }))}
                    placeholder="e.g. 6001234567890"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={product.sizes.length > 0 || !product.barcode.trim()}
                    onClick={() => applyProductScan(product.barcode)}
                    title="Look up this code and fill the form"
                  >
                    <Icon name="refresh" size={15} /> Fill
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={product.sizes.length > 0}
                    onClick={() => setScanTarget({
                      title: 'Scan barcode or QR label',
                      hint: 'Scan a code or QR label. Existing items open in edit mode; new QR labels fill the form.',
                      apply: applyProductScan
                    })}
                  >
                    <Icon name="scan" size={15} /> Scan
                  </Button>
                </div>
              </Field>
              <Field label="Product photo" hint="Optional. Storage is inline unless an S3 bucket is configured.">
                <ImagePicker
                  value={product.imageUrl}
                  onChange={(imageUrl) => setProduct((current) => ({ ...current, imageUrl }))}
                  onError={setImageError}
                />
              </Field>
              {imageError && <div className="alert alert-error" role="alert">{imageError}</div>}
              <Field label="Price (GH₵)"><Input type="number" min="0" step="0.01" value={product.price} onChange={(event) => setProduct({ ...product, price: event.target.value })} required /></Field>
              <Field label="Cost (GH₵)"><Input type="number" min="0" step="0.01" value={product.cost} onChange={(event) => setProduct({ ...product, cost: event.target.value })} /></Field>
              {!editingProductId && (
                <Field label="Opening stock" hint="Added to every branch, per size"><Input type="number" min="0" step="1" value={product.openingStock} onChange={(event) => setProduct({ ...product, openingStock: event.target.value })} /></Field>
              )}

              {selectedCategory.sizes.length > 0 && !editingProductId ? (
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
                <Button type="submit">{editingProductId ? 'Save changes' : 'Save product'}</Button>
              </div>
            </form>
          </Card>
          <Card title="Add category" subtitle="Create product categories and their size options. Edit existing categories right in the table below.">
            <form className="form-grid" onSubmit={async (event) => {
              event.preventDefault();
              const payload = {
                name: category.name,
                sizeLabel: category.sizeLabel,
                sizes: category.sizes,
                active: category.active
              };
              create(admin.createCategory, payload, () => setCategory(blankCategory));
            }}>
              <Field label="Category name"><Input value={category.name} onChange={(event) => setCategory({ ...category, name: event.target.value })} required /></Field>
              <Field label="Size label" hint="Example: Shoe size, Waist size, Size"><Input value={category.sizeLabel} onChange={(event) => setCategory({ ...category, sizeLabel: event.target.value })} /></Field>
              <Field label="Sizes" hint="Comma-separated. Leave blank for no-size items."><Input value={category.sizes} onChange={(event) => setCategory({ ...category, sizes: event.target.value })} placeholder="e.g. 38, 39, 40 or S, M, L" /></Field>
              <div className="row">
                <Button type="submit">Save category</Button>
              </div>
            </form>
          </Card>
          <Card title="Categories" subtitle="Use Edit to change a category right in the table. Enter saves, Esc cancels.">
            <DataTable
              sortable
              onSaveEdit={(row, draft) => admin.updateCategory({
                id: row.id,
                name: draft.name,
                sizeLabel: draft.sizeLabel,
                sizes: draft.sizes,
                active: row.active
              })}
              columns={[
                { key: 'name', label: 'Name', editable: true, render: (row) => row.name },
                { key: 'sizeLabel', label: 'Size label', editable: true, editValue: (row) => row.sizeLabel || 'Size', render: (row) => row.sizeLabel || 'Size' },
                { key: 'sizes', label: 'Sizes', editable: true, editValue: (row) => Array.isArray(row.sizes) ? row.sizes.join(', ') : '', render: (row) => row.sizes?.length ? row.sizes.join(', ') : 'No size' },
                { key: 'status', label: 'Status', render: (row) => row.active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge> },
                { key: 'action', label: '', render: (row, helpers) => inlineActions(row, helpers, (
                  <Button variant="ghost" onClick={() => {
                    if (row.active && !window.confirm(`Deactivate category "${row.name}"?`)) return;
                    admin.updateCategory({
                      id: row.id,
                      name: row.name,
                      sizeLabel: row.sizeLabel || 'Size',
                      sizes: Array.isArray(row.sizes) ? row.sizes : [],
                      active: !row.active
                    });
                  }}>{row.active ? 'Deactivate' : 'Activate'}</Button>
                )) }
              ]}
              rows={filteredCategories}
              empty={q ? 'No categories match your search.' : 'No categories yet.'}
            />
          </Card>
          <Card
            title="Products"
            subtitle="Use Edit to change a product right in the table. Codes stay fixed to protect sales history. Label prints a QR shelf tag."
            actions={<Button variant="secondary" onClick={() => setShowLabelSheet(true)}>Print label sheet</Button>}
          >
            <DataTable
              sortable
              onSaveEdit={(row, draft) => admin.updateProduct({
                id: row.id,
                name: draft.name,
                category: draft.category,
                size: draft.size,
                barcode: draft.barcode,
                imageUrl: draft.image_url,
                price: draft.price,
                cost: draft.cost,
                active: row.active
              })}
              columns={[
                { key: 'sku', label: 'Code', render: (row) => row.sku },
                { key: 'image_url', label: 'Photo', editable: true,
                  editValue: (row) => row.image_url || '',
                  editRender: (value, onChange) => (
                    <ImagePicker compact value={value || ''} onChange={onChange} onError={setImageError} />
                  ),
                  render: (row) => row.image_url
                    ? <img className="table-thumb" src={row.image_url} alt="" loading="lazy" />
                    : <span className="muted">—</span> },
                { key: 'name', label: 'Name', editable: true, render: (row) => row.name },
                { key: 'size', label: 'Size', editable: true, editValue: (row) => row.size || '', render: (row) => row.size || '—' },
                { key: 'barcode', label: 'Barcode', editable: true,
                  editValue: (row) => row.barcode || '',
                  editRender: (value, onChange) => (
                    <div className="row">
                      <Input value={value ?? ''} onChange={(event) => onChange(event.target.value)} aria-label="Edit barcode" placeholder="Scan or type" />
                      <Button variant="secondary" onClick={() => setScanTarget({ title: 'Scan barcode', apply: (code) => onChange(code) })}>Scan</Button>
                    </div>
                  ),
                  render: (row) => row.barcode || '—' },
                { key: 'category', label: 'Category', editable: true,
                  editValue: (row) => row.category || 'other',
                  editRender: (value, onChange) => (
                    <Select value={value} onChange={(event) => onChange(event.target.value)} aria-label="Edit category">
                      {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </Select>
                  ),
                  render: (row) => resolveCategoryLabel(row.category) },
                { key: 'price', label: 'Price', editable: true, editType: 'number', editValue: (row) => String(row.price ?? ''), render: (row) => money(row.price) },
                { key: 'cost', label: 'Cost', editable: true, editType: 'number', editValue: (row) => String(row.cost ?? ''), render: (row) => row.cost != null ? money(row.cost) : '—' },
                { key: 'status', label: 'Status', render: (row) => row.active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge> },
                { key: 'action', label: '', render: (row, helpers) => inlineActions(row, helpers, (
                  <>
                    <Button variant="ghost" onClick={() => setLabelProduct(row)}>Label</Button>
                    <Button variant="ghost" onClick={() => {
                      if (row.active && !window.confirm(`Deactivate ${displayProductName(row.name, row.size)}?`)) return;
                      admin.updateProduct({
                        id: row.id,
                        name: row.name,
                        category: row.category || 'other',
                        size: row.size,
                        price: row.price,
                        cost: row.cost,
                        active: !row.active
                      });
                    }}>{row.active ? 'Deactivate' : 'Activate'}</Button>
                  </>
                )) }
              ]}
              rows={filteredProducts}
              empty={q ? 'No products match your search.' : 'No products yet.'}
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
          <Card
            title="Stock on hand"
            subtitle="Every item with a stock record, by branch. Edit a quantity straight from the table."
            actions={(
              <label className="stock-filter">
                <Icon name="store" size={16} />
                <Select
                  value={stockBranchId}
                  onChange={(event) => setStockBranchId(event.target.value)}
                  aria-label="Filter stock by branch"
                >
                  <option value="">All branches</option>
                  {admin.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </Select>
              </label>
            )}
          >
            {stockFormError ? (
              <div className="alert alert-error stock-error" role="alert">
                <Icon name="alert" size={16} />
                <span>{stockFormError}</span>
              </div>
            ) : null}
            <DataTable
              sortable
              columns={[
                { key: 'branch', label: 'Branch', render: (row) => (
                  <span className="cell-with-icon"><Icon name="store" size={15} />{row.branch_name}</span>
                ) },
                { key: 'sku', label: 'Code', render: (row) => <code className="code-chip">{row.sku}</code> },
                { key: 'name', label: 'Item', render: (row) => displayProductName(row.product_name, row.size) },
                {
                  key: 'qty',
                  label: 'On hand',
                  editable: true,
                  editValue: (row) => String(row.qty ?? 0),
                  editRender: (value, onChange) => (
                    <div className="qty-editor">
                      <button
                        type="button"
                        className="qty-step"
                        onClick={() => onChange(String(Math.max(0, Number(value || 0) - 1)))}
                        aria-label="Decrease quantity"
                      >
                        <Icon name="minus" size={14} />
                      </button>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={value ?? ''}
                        onChange={(event) => onChange(event.target.value)}
                        aria-label="Stock on hand"
                        autoFocus
                      />
                      <button
                        type="button"
                        className="qty-step"
                        onClick={() => onChange(String(Number(value || 0) + 1))}
                        aria-label="Increase quantity"
                      >
                        <Icon name="plus" size={14} />
                      </button>
                    </div>
                  ),
                  render: (row) => (
                    <span className={`qty-cell${row.qty <= row.low_at ? ' is-low' : ''}`}>
                      <Icon name="box" size={16} />
                      <strong>{row.qty}</strong>
                    </span>
                  )
                },
                { key: 'low', label: 'Reorder at', render: (row) => row.low_at },
                { key: 'state', label: 'State', render: (row) => row.qty <= row.low_at
                  ? <Badge tone="warning"><Icon name="alert" size={13} /> Low</Badge>
                  : <Badge tone="success"><Icon name="check" size={13} /> OK</Badge> },
                { key: 'action', label: '', render: (row, helpers) => stockActions(row, helpers) }
              ]}
              rows={stockRows}
              onSaveEdit={saveStockQty}
              empty={q || stockBranchId ? 'No stock records match your filters.' : 'No stock records yet.'}
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
          <Card title="Customers" subtitle="Edit name and contact details in the table; use Details for credit limit, tags and notes." actions={<Button variant="secondary" onClick={downloadCustomers}>Export JSON</Button>}>
            <DataTable
              sortable
              onSaveEdit={(row, draft) => admin.updateCustomer({
                id: row.id,
                name: draft.name,
                phone: draft.phone,
                email: draft.email,
                tags: row.tags,
                notes: row.notes,
                creditLimit: row.credit_limit ?? 0,
                active: row.active !== 0
              })}
              columns={[
                { key: 'name', label: 'Name', editable: true, render: (row) => row.name },
                { key: 'phone', label: 'Phone', editable: true, render: (row) => row.phone || '—' },
                { key: 'email', label: 'Email', editable: true, render: (row) => row.email || '—' },
                { key: 'status', label: 'Status', render: (row) => row.active === 0 ? <Badge>Inactive</Badge> : <Badge tone="success">Active</Badge> },
                { key: 'action', label: '', render: (row, helpers) => inlineActions(row, helpers, (
                  <>
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
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}>Details</Button>
                    <Button variant="ghost" onClick={() => {
                      if (row.active !== 0 && !window.confirm(`Deactivate ${row.name}?`)) return;
                      admin.updateCustomer({
                        id: row.id,
                        name: row.name,
                        phone: row.phone,
                        email: row.email,
                        tags: row.tags,
                        notes: row.notes,
                        creditLimit: row.credit_limit ?? 0,
                        active: row.active === 0
                      });
                    }}>{row.active === 0 ? 'Activate' : 'Deactivate'}</Button>
                  </>
                )) }
              ]}
              rows={filteredCustomers}
              empty={q ? 'No customers match your search.' : 'No customers yet.'}
            />
          </Card>
        </div>
      )}

      {admin.tab === 'Sales' && (
        <Card
          title="All sales"
          subtitle="Tap a receipt number to view or print it. Search by receipt, cashier or MoMo/card transaction ID."
          actions={<Button variant="secondary" onClick={() => setShowReceiptScanner(true)}>Scan receipt</Button>}
        >
          <DataTable
            sortable
            columns={[
              { key: 'receipt', label: 'Receipt', render: (row) => (
                <button type="button" className="link-button" onClick={() => openReceipt(row.receipt_no)} aria-label={`Open receipt ${row.receipt_no}`}>
                  {row.receipt_no}
                </button>
              ) },
              { key: 'time', label: 'Time', render: (row) => dateTime(row.created_at) },
              { key: 'branch', label: 'Branch', render: (row) => row.branch_name },
              { key: 'cashier', label: 'Cashier', render: (row) => row.cashier_name },
              { key: 'payment', label: 'Payment', render: (row) => row.payment_method },
              { key: 'transaction', label: 'Transaction ID', render: (row) => row.transaction_ref || <span className="muted">—</span> },
              { key: 'total', label: 'Total', render: (row) => money(row.total) }
            ]}
            rows={filteredSales}
            empty={q ? 'No sales match your search.' : 'No sales recorded.'}
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
          <Card title="Staff" subtitle="Edit details in the table; use Details to set a new PIN or password.">
            <DataTable
              sortable
              onSaveEdit={(row, draft) => admin.updateUser({
                id: row.id,
                name: draft.name,
                username: draft.username,
                role: draft.role,
                branchId: draft.branchId,
                active: row.active
              })}
              columns={[
                { key: 'name', label: 'Name', editable: true, render: (row) => row.name },
                { key: 'username', label: 'Username', editable: true, render: (row) => row.username },
                { key: 'role', label: 'Role', editable: true,
                  editValue: (row) => row.role || 'cashier',
                  editRender: (value, onChange) => (
                    <Select value={value} onChange={(event) => onChange(event.target.value)} aria-label="Edit role">
                      <option value="cashier">Cashier</option>
                      <option value="admin">Admin</option>
                    </Select>
                  ),
                  render: (row) => <Badge>{row.role}</Badge> },
                { key: 'branch', label: 'Branch', editable: true,
                  editValue: (row) => row.branch_id ? String(row.branch_id) : '',
                  editRender: (value, onChange) => (
                    <Select value={value} onChange={(event) => onChange(event.target.value)} aria-label="Edit branch">
                      <option value="">All branches</option>
                      {admin.branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </Select>
                  ),
                  render: (row) => admin.branches.find((b) => b.id === row.branch_id)?.name || 'All' },
                { key: 'status', label: 'Status', render: (row) => row.active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge> },
                { key: 'action', label: '', render: (row, helpers) => inlineActions(row, helpers, (
                  <>
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
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}>Details</Button>
                    <Button variant="ghost" onClick={() => {
                      if (row.active && !window.confirm(`Deactivate ${row.name}? They will no longer be able to sign in.`)) return;
                      admin.updateUser({
                        id: row.id,
                        name: row.name,
                        username: row.username,
                        role: row.role,
                        branchId: row.branch_id,
                        active: !row.active
                      });
                    }}>{row.active ? 'Deactivate' : 'Activate'}</Button>
                  </>
                )) }
              ]}
              rows={filteredUsers}
              empty={q ? 'No staff match your search.' : 'No staff yet.'}
            />
          </Card>
        </div>
      )}

      {admin.tab === 'Branches' && (
        <div className="stack">
          <Card title="Add branch" subtitle="Edit existing branches right in the table below.">
            <form className="form-grid" onSubmit={async (event) => {
              event.preventDefault();
              create(admin.createBranch, branch, () => setBranch(blankBranch));
            }}>
              <Field label="Name"><Input value={branch.name} onChange={(event) => setBranch({ ...branch, name: event.target.value })} required /></Field>
              <Field label="Code"><Input value={branch.code} onChange={(event) => setBranch({ ...branch, code: event.target.value })} /></Field>
              <div className="row">
                <Button type="submit">Save branch</Button>
              </div>
            </form>
          </Card>
          <Card title="Branches">
            <DataTable
              sortable
              onSaveEdit={(row, draft) => admin.updateBranch({
                id: row.id,
                name: draft.name,
                code: draft.code,
                active: draft.active
              })}
              columns={[
                { key: 'name', label: 'Name', editable: true, render: (row) => row.name },
                { key: 'code', label: 'Code', editable: true, render: (row) => row.code },
                { key: 'active', label: 'Status', editable: true,
                  editValue: (row) => Boolean(row.active),
                  editRender: (value, onChange) => (
                    <label className="check">
                      <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
                      Active
                    </label>
                  ),
                  render: (row) => row.active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge> },
                { key: 'action', label: '', render: (row, helpers) => inlineActions(row, helpers) }
              ]}
              rows={filteredBranches}
              empty={q ? 'No branches match your search.' : 'No branches yet.'}
            />
          </Card>
        </div>
      )}

      {admin.tab === 'Outbox' && (
        <div className="stack">
          <Card title="Notification outbox" subtitle="Events waiting for the future WhatsApp/SMS worker.">
            <DataTable
              sortable
              columns={[
                { key: 'id', label: 'ID', render: (row) => row.id },
                { key: 'type', label: 'Event', render: (row) => row.event_type },
                { key: 'entity', label: 'Sale', render: (row) => row.entity_id },
                { key: 'status', label: 'Status', render: (row) => <Badge tone="warning">{row.status}</Badge> },
                { key: 'created', label: 'Created', render: (row) => dateTime(row.created_at) }
              ]}
              rows={filteredOutbox}
              empty={q ? 'No events match your search.' : 'No events yet.'}
            />
          </Card>
          <Card title="Audit log">
            <DataTable
              sortable
              columns={[
                { key: 'time', label: 'Time', render: (row) => dateTime(row.created_at) },
                { key: 'user', label: 'User', render: (row) => row.user_name || 'Installer' },
                { key: 'action', label: 'Action', render: (row) => row.action },
                { key: 'entity', label: 'Record', render: (row) => `${row.entity} #${row.entity_id}` }
              ]}
              rows={filteredAudit}
              empty={q ? 'No audit entries match your search.' : 'No activity yet.'}
            />
          </Card>
        </div>
      )}

      {admin.tab === 'Insights' && (
        <div className="stack">
          <div className="stats-grid">
            <Card><p className="stat-label">Shop views</p><p className="stat-value">{analyticsByName('shop_view')}</p></Card>
            <Card><p className="stat-label">Product opens</p><p className="stat-value">{analyticsByName('product_open')}</p></Card>
            <Card><p className="stat-label">Add to bag</p><p className="stat-value">{analyticsByName('add_to_cart')}</p></Card>
            <Card><p className="stat-label">WhatsApp clicks</p><p className="stat-value">{analyticsByName('whatsapp_click')}</p></Card>
          </div>
          <Card title="Storefront analytics" subtitle="Privacy-safe counts only. No names, phone numbers, addresses or payment details are stored.">
            <Table
              columns={[
                { key: 'eventName', label: 'Event' },
                { key: 'events', label: 'Events' },
                { key: 'sessions', label: 'Sessions' }
              ]}
              rows={admin.analytics?.totals || []}
              empty="No storefront events yet."
            />
          </Card>
          <Card title="Top products" subtitle="Based on product opens, add-to-bag and WhatsApp clicks.">
            <Table
              columns={[
                { key: 'name', label: 'Product' },
                { key: 'sku', label: 'SKU' },
                { key: 'events', label: 'Events' }
              ]}
              rows={admin.analytics?.topProducts || []}
              empty="No product events yet."
            />
          </Card>
        </div>
      )}

      {admin.tab === 'Shop settings' && (
        <div className="stack">
          <Card title="Storefront" subtitle="Public shop details shown at checkout.">
            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault();
                admin.updateShopSettings({
                  ...shopForm,
                  deliveryOptions: shopForm.deliveryOptions.split('\n').map((value) => value.trim()).filter(Boolean),
                  paymentOptions: shopForm.paymentOptions.split('\n').map((value) => value.trim()).filter(Boolean)
                });
              }}
            >
              <Field label="Company name" hint="Used on the shop and receipts.">
                <Input
                  value={shopForm.companyName}
                  onChange={(event) => setShopForm((current) => ({ ...current, companyName: event.target.value }))}
                  maxLength={80}
                  required
                />
              </Field>
              <Field
                label="WhatsApp number"
                hint="Include the country code. A Ghana 0… number is converted to 233… automatically."
              >
                <Input
                  type="tel"
                  value={shopForm.whatsappNumber}
                  onChange={(event) => setShopForm((current) => ({ ...current, whatsappNumber: event.target.value }))}
                  placeholder="024 123 4567 or +233 24 123 4567"
                  maxLength={30}
                />
              </Field>
              <Field label="Delivery options" hint="One option per line. Shown as checkout choices.">
                <textarea className="input shop-textarea" rows={4} value={shopForm.deliveryOptions} onChange={(event) => setShopForm((current) => ({ ...current, deliveryOptions: event.target.value }))} />
              </Field>
              <Field label="Payment preferences" hint="One option per line. These are preferences only; no payment is collected online.">
                <textarea className="input shop-textarea" rows={4} value={shopForm.paymentOptions} onChange={(event) => setShopForm((current) => ({ ...current, paymentOptions: event.target.value }))} />
              </Field>
              <div className="row-between">
                <Button type="submit">Save shop settings</Button>
                <a href="/shop" target="_blank" rel="noopener noreferrer">Open the storefront ↗</a>
              </div>
            </form>
          </Card>
          <Card title="Checkout handoff SOP" subtitle="How staff should handle WhatsApp orders.">
            <ol className="shop-sop">
              <li><strong>Read the reference.</strong> Every WhatsApp order includes a Ref like <code>SW-260411-A1B2</code>. Quote it in the chat.</li>
              <li><strong>Confirm stock live.</strong> Storefront availability is not a reservation. Check the selected size in the correct branch before taking payment.</li>
              <li><strong>Confirm delivery and payment.</strong> Use the structured choices in the message. Never ask for card numbers or MoMo PINs in chat.</li>
              <li><strong>Record the sale in POS.</strong> Only after confirmation, create the sale in <a href="/staff/pos">/staff/pos</a> with the right branch, cashier and payment method.</li>
              <li><strong>Close the loop.</strong> Send the receipt in WhatsApp. If stock changed, adjust it before confirming another order.</li>
            </ol>
          </Card>
        </div>
      )}
      {scanTarget && (
        <ScannerModal
          title={scanTarget.title}
          hint={scanTarget.hint || 'Point the camera at the barcode, or type it below. The first scan fills the field.'}
          onClose={() => setScanTarget(null)}
          onDetect={(code) => {
            scanTarget.apply(code);
            setScanTarget(null);
          }}
        />
      )}

      {labelProduct && (
        <Modal title="Product label" onClose={() => setLabelProduct(null)}>
          <div className="print-area label">
            <QrCode value={productQrValue(labelProduct)} size={150} alt={`QR code for ${labelProduct.sku}`} />
            <strong>{displayProductName(labelProduct.name, labelProduct.size)}</strong>
            <span className="label-price">{money(labelProduct.price)}</span>
            <small>{labelProduct.sku}</small>
            {labelProduct.barcode && <small>{labelProduct.barcode}</small>}
          </div>
          <p className="muted no-print">The QR code carries the item code, name, size, category and prices. Scan it in Admin to refill the product form; any scanner can also read it at the till.</p>
          <div className="row no-print">
            <Button onClick={() => window.print()}>Print label</Button>
            <Button variant="ghost" onClick={() => setLabelProduct(null)}>Close</Button>
          </div>
        </Modal>
      )}

      {showLabelSheet && (
        <Modal title={`Label sheet — ${filteredProducts.length} item${filteredProducts.length === 1 ? '' : 's'}`} onClose={() => setShowLabelSheet(false)}>
          <p className="muted no-print">One label per item, using the current search filter. Print on A4 and cut along the gaps.</p>
          <div className="print-area label-sheet">
            {filteredProducts.map((row) => (
              <div className="label" key={row.id}>
                <QrCode value={productQrValue(row)} size={90} alt={`QR code for ${row.sku}`} />
                <strong>{displayProductName(row.name, row.size)}</strong>
                <span className="label-price">{money(row.price)}</span>
                <small>{row.sku}</small>
              </div>
            ))}
            {!filteredProducts.length && <p className="muted">No products match the current filter.</p>}
          </div>
          <div className="row no-print">
            <Button onClick={() => window.print()} disabled={!filteredProducts.length}>Print sheet</Button>
            <Button variant="ghost" onClick={() => setShowLabelSheet(false)}>Close</Button>
          </div>
        </Modal>
      )}

      {showReceiptScanner && (
        <ScannerModal
          title="Scan a receipt QR code"
          hint="Point the camera at the QR code on a printed receipt to open it."
          onClose={() => setShowReceiptScanner(false)}
          onDetect={async (code) => {
            setShowReceiptScanner(false);
            await openReceipt(code);
          }}
        />
      )}

      {receiptOpen && receiptData && (
        <ReceiptModal receipt={receiptData} onClose={() => setReceiptOpen(false)} />
      )}
    </Shell>
  );
}
