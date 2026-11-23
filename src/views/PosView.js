'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '../viewmodels/useSession';
import { usePos } from '../viewmodels/usePos';
import { useBarcodeScanner } from '../viewmodels/useBarcodeScanner';
import { apiGet } from '../viewmodels/api';
import { categoryLabel, displayProductName } from '../models/productOptions';
import { money, dateTime } from './format';
import { Badge, Button, Card, DataTable, Field, Input, Modal, Select, Shell } from './components/ui';
import { ScannerModal } from './components/ScannerModal';
import { ReceiptModal } from './components/ReceiptModal';

const FAVORITES_KEY = 'slawn.pos.favorites';
const RECENT_KEY = 'slawn.pos.recent';

function readStoredList(key) {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}

function writeStoredList(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode etc.) — pinning just won't persist.
  }
}

function stockShortfall(record) {
  if (record.conflict?.code !== 'INSUFFICIENT_STOCK' || !record.conflict.details) return null;
  const requested = Number(record.conflict.details.requested) || 0;
  const available = Number(record.conflict.details.available) || 0;
  return Math.max(requested - available, 1);
}

function queuedTotal(record, products) {
  const subtotal = (record.payload.items || []).reduce((sum, item) => {
    const product = products.find((entry) => entry.sku === item.sku);
    return sum + (product ? Number(product.price) * Number(item.qty) : 0);
  }, 0);
  return Math.max(subtotal - (Number(record.payload.discount) || 0), 0);
}

export default function PosView() {
  const router = useRouter();
  const { user, loading, signOut, sessionExpiring } = useSession();
  const pos = usePos();
  const [code, setCode] = useState('');
  const [showCustomer, setShowCustomer] = useState(false);
  const [showConflicts, setShowConflicts] = useState(false);
  const [sizeGroup, setSizeGroup] = useState(null);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', consent: true });
  const [fixQty, setFixQty] = useState({});
  const [productSearch, setProductSearch] = useState('');
  const [removedLine, setRemovedLine] = useState(null);
  const [favorites, setFavorites] = useState(() => readStoredList(FAVORITES_KEY));
  const [recent, setRecent] = useState(() => readStoredList(RECENT_KEY));
  const [showScanner, setShowScanner] = useState(false);
  const [scannerMode, setScannerMode] = useState('sale');
  const [scanFlash, setScanFlash] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  useEffect(() => {
    if (!removedLine) return;
    const timer = window.setTimeout(() => setRemovedLine(null), 5000);
    return () => window.clearTimeout(timer);
  }, [removedLine]);

  useEffect(() => {
    if (!scanFlash) return;
    const timer = window.setTimeout(() => setScanFlash(null), 2600);
    return () => window.clearTimeout(timer);
  }, [scanFlash]);

  const rememberRecent = (key) => {
    setRecent((current) => {
      const next = [key, ...current.filter((entry) => entry !== key)].slice(0, 8);
      writeStoredList(RECENT_KEY, next);
      return next;
    });
  };

  // Hardware scanner (keyboard wedge) and camera scans both land here.
  const handleScan = async (rawCode) => {
    const product = await pos.addByCode(rawCode);
    setCode('');
    setProductSearch('');
    if (product) {
      rememberRecent(`${product.category || 'other'}||${product.name}`);
      setScanFlash({ message: `Added ${displayProductName(product.name, product.size)}`, tone: 'success' });
    }
  };

  const openReceipt = async (receiptNo) => {
    try {
      const sale = await apiGet(`/sales/receipt?no=${encodeURIComponent(receiptNo)}`);
      setReceiptData(sale);
      setReceiptOpen(true);
    } catch (failure) {
      setScanFlash({ message: failure.message || 'Receipt not found.', tone: 'error' });
    }
  };

  const anyModalOpen = showCustomer || showConflicts || Boolean(sizeGroup) || showScanner || receiptOpen;
  useBarcodeScanner(handleScan, { enabled: !anyModalOpen });

  const productGroups = useMemo(() => {
    const groups = new Map();
    for (const product of pos.products.filter((item) => item.active !== 0)) {
      const key = `${product.category || 'other'}||${product.name}`;
      const group = groups.get(key) || {
        key,
        name: product.name,
        category: product.category || 'other',
        variants: []
      };
      group.variants.push(product);
      groups.set(key, group);
    }
    return [...groups.values()]
      .map((group) => ({
        ...group,
        variants: [...group.variants].sort((a, b) => String(a.size || '').localeCompare(String(b.size || ''), undefined, { numeric: true }))
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [pos.products]);

  const visibleGroups = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    const filtered = !query ? productGroups : productGroups.filter((group) =>
      [group.name, categoryLabel(group.category), ...group.variants.map((variant) => variant.sku)]
        .some((value) => String(value || '').toLowerCase().includes(query))
    );
    const rank = (group) => {
      const favoriteIndex = favorites.indexOf(group.key);
      if (favoriteIndex >= 0) return favoriteIndex;
      const recentIndex = recent.indexOf(group.key);
      if (recentIndex >= 0) return 1000 + recentIndex;
      return 2000;
    };
    return [...filtered].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }, [productGroups, productSearch, favorites, recent]);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) return <div className="center-screen"><p>Loading…</p></div>;

  const toggleFavorite = (key) => {
    const next = favorites.includes(key)
      ? favorites.filter((entry) => entry !== key)
      : [...favorites, key];
    setFavorites(next);
    writeStoredList(FAVORITES_KEY, next);
  };

  const recordRecent = (key) => rememberRecent(key);

  const chooseGroup = (group) => {
    recordRecent(group.key);
    const hasSizes = group.variants.length > 1 || group.variants.some((variant) => variant.size);
    if (hasSizes) setSizeGroup(group);
    else pos.addProduct(group.variants[0]);
  };

  const groupStock = (group) => {
    let total = 0;
    let low = false;
    for (const variant of group.variants) {
      const record = pos.stockBySku[variant.sku];
      const qty = record ? Number(record.qty) : 0;
      total += qty;
      if (record && qty <= Number(record.low_at)) low = true;
    }
    if (total <= 0) return { tone: 'danger', label: 'Out of stock' };
    if (low) return { tone: 'warning', label: 'Low stock' };
    return null;
  };

  const addCode = async (event) => {
    event.preventDefault();
    const product = await pos.addByCode(code);
    if (product) {
      recordRecent(`${product.category || 'other'}||${product.name}`);
      setCode('');
    }
  };

  const completeSale = async () => {
    const result = await pos.submit();
    if (result?.receiptNo) {
      setReceiptData(result);
      setReceiptOpen(true);
    }
  };

  const saveCustomer = async (event) => {
    event.preventDefault();
    const done = await pos.addCustomer({
      name: newCustomer.name,
      phone: newCustomer.phone,
      consent: newCustomer.consent
    });
    if (done) {
      setShowCustomer(false);
      setNewCustomer({ name: '', phone: '', consent: true });
    }
  };

  const addStock = async (event, record, shortfall) => {
    event.preventDefault();
    const delta = Number(fixQty[record.id] ?? shortfall);
    if (!delta || delta <= 0) return;
    const done = await pos.adjustStock({
      branchId: record.payload.branchId,
      sku: record.conflict.details.sku,
      delta
    });
    if (done) setFixQty((current) => ({ ...current, [record.id]: shortfall }));
  };

  const voidSale = async (record) => {
    const confirmed = window.confirm(
      'Void this sale? It will be removed from this device and cannot be recovered.'
    );
    if (confirmed) await pos.voidQueuedSale(record.id);
  };

  const cartColumns = [
    { key: 'name', label: 'Item', render: (line) => <><strong>{displayProductName(line.name, line.size)}</strong><br /><small>{line.sku}</small></> },
    { key: 'qty', label: 'Qty', render: (line) => (
      <Input
        type="number"
        min="1"
        value={line.qty}
        onChange={(event) => pos.setQuantity(line.sku, event.target.value)}
        className="qty-input"
        aria-label={`Quantity for ${displayProductName(line.name, line.size)}`}
      />
    ) },
    { key: 'price', label: 'Price', render: (line) => money(line.price) },
    { key: 'total', label: 'Total', render: (line) => money(line.price * line.qty) },
    { key: 'remove', label: '', render: (line) => (
      <Button variant="ghost" onClick={() => { setRemovedLine(line); pos.removeLine(line.sku); }} aria-label={`Remove ${displayProductName(line.name, line.size)}`}>×</Button>
    ) }
  ];

  const saleColumns = [
    { key: 'receipt', label: 'Receipt', render: (sale) => (
      <button type="button" className="link-button" onClick={() => openReceipt(sale.receipt_no)} aria-label={`Open receipt ${sale.receipt_no}`}>
        {sale.receipt_no}
      </button>
    ) },
    { key: 'time', label: 'Time', render: (sale) => dateTime(sale.created_at) },
    { key: 'branch', label: 'Branch', render: (sale) => sale.branch_name },
    { key: 'total', label: 'Total', render: (sale) => money(sale.total) }
  ];

  return (
    <Shell
      user={user}
      onSignOut={signOut}
      sessionExpiring={sessionExpiring}
      links={[
        { href: '/pos', label: 'POS' },
        ...(user.role === 'admin' ? [{ href: '/admin', label: 'Admin' }] : [])
      ]}
    >
      {pos.offline && <div className="alert alert-warn">You are offline. Sales will be queued on this device.</div>}
      {pos.conflicts.length > 0 && (
        <div className="alert alert-error" role="alert">
          <span>
            {pos.conflicts.length} queued sale{pos.conflicts.length > 1 ? 's' : ''} could not sync.
            Fix the issue before retrying.
          </span>
          <Button variant="ghost" onClick={() => setShowConflicts(true)}>Review</Button>
        </div>
      )}
      {pos.queue.length > 0 && (
        <div className="alert alert-info">
          <span>{pos.queue.length} sale{pos.queue.length > 1 ? 's' : ''} saved on this device.</span>
          <Button variant="ghost" onClick={pos.syncQueue}>Sync now</Button>
        </div>
      )}
      {pos.error && <div className="alert alert-error" role="alert">{pos.error}</div>}
      {pos.receipt?.receiptNo && (
        <div className="alert alert-success" role="status">
          <span>Sale saved — {pos.receipt.receiptNo} — {money(pos.receipt.total)}</span>
          <Button variant="ghost" onClick={() => { setReceiptData(pos.receipt); setReceiptOpen(true); }}>View receipt</Button>
        </div>
      )}
      {pos.receipt?.queued && <div className="alert alert-warn">Saved on this device. It will sync when the internet returns.</div>}
      {removedLine && (
        <div className="toast" role="status">
          <span>Removed {displayProductName(removedLine.name, removedLine.size)}.</span>
          <Button variant="secondary" onClick={() => { pos.restoreLine(removedLine); setRemovedLine(null); }}>Undo</Button>
        </div>
      )}
      {scanFlash && (
        <div className={scanFlash.tone === 'error' ? 'toast toast-error' : 'toast'} role="status">
          <span>{scanFlash.message}</span>
        </div>
      )}

      <div className="pos-grid">
        <Card
          title="Products"
          subtitle="Tap an item, type its code, or scan a barcode. Star pins favourites to the top."
          actions={<Button variant="secondary" onClick={() => { setScannerMode('sale'); setShowScanner(true); }}>Scan with camera</Button>}
        >
          <form className="row" onSubmit={addCode}>
            <Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Item code" autoFocus aria-label="Item code" />
            <Button type="submit">Add</Button>
          </form>

          <div className="product-search">
            <Input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search products..." aria-label="Search products" />
          </div>
          <div className="product-grid">
            {visibleGroups.map((group) => {
              const hasSizes = group.variants.length > 1 || group.variants.some((variant) => variant.size);
              const price = group.variants[0]?.price;
              const stock = groupStock(group);
              const isFavorite = favorites.includes(group.key);
              return (
                <div
                  key={group.key}
                  role="button"
                  tabIndex={0}
                  className={isFavorite ? 'product is-favorite' : 'product'}
                  onClick={() => chooseGroup(group)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      chooseGroup(group);
                    }
                  }}
                >
                  <button
                    type="button"
                    className="product-pin"
                    aria-pressed={isFavorite}
                    aria-label={isFavorite ? `Unpin ${group.name}` : `Pin ${group.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleFavorite(group.key);
                    }}
                  >
                    {isFavorite ? '★' : '☆'}
                  </button>
                  <strong>{group.name}</strong>
                  <span>{categoryLabel(group.category)}</span>
                  {hasSizes ? (
                    <span className="muted">{group.variants.length} sizes</span>
                  ) : (
                    <span>{group.variants[0]?.sku}</span>
                  )}
                  {stock && <span className="product-stock"><Badge tone={stock.tone}>{stock.label}</Badge></span>}
                  <span className="product-price">{money(price)}</span>
                </div>
              );
            })}
            {!visibleGroups.length && <p className="muted">{productSearch ? 'No products match your search.' : 'No products yet. Ask the admin to add some.'}</p>}
          </div>
        </Card>

        <Card title="Current sale">
          <DataTable columns={cartColumns} rows={pos.cart} empty="No items added." />
          <div className="stack">
            <div className="row">
              <Field label="Payment">
                <Select value={pos.paymentMethod} onChange={(event) => pos.setPaymentMethod(event.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="momo">Mobile money</option>
                  <option value="card">Card</option>
                  <option value="credit">Credit</option>
                </Select>
              </Field>
              <Field label="Discount">
                <Input type="number" min="0" value={pos.discount} onChange={(event) => pos.setDiscount(event.target.value)} placeholder="0.00" />
              </Field>
            </div>
            <Field label="Customer">
              <div className="row">
                <Select value={pos.customerId} onChange={(event) => pos.setCustomerId(event.target.value)}>
                  <option value="">Walk-in customer</option>
                  {pos.customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                  ))}
                </Select>
                <Button variant="secondary" onClick={() => setShowCustomer(true)}>+ New</Button>
              </div>
            </Field>
            <div className="total-line">
              <span>Total</span>
              <strong>{money(Math.max(pos.cartTotal - (Number(pos.discount) || 0), 0))}</strong>
            </div>
            <Button disabled={pos.busy || !pos.cart.length} onClick={completeSale}>
              {pos.busy ? 'Saving…' : 'Complete sale'}
            </Button>
          </div>
        </Card>
      </div>

      <Card
        title="Recent sales"
        subtitle="Latest sales for this branch. Tap a receipt to view or print it."
        actions={<Button variant="secondary" onClick={() => { setScannerMode('receipt'); setShowScanner(true); }}>Scan receipt</Button>}
      >
        <DataTable columns={saleColumns} rows={pos.sales} empty="No sales recorded yet." />
      </Card>

      {showCustomer && (
        <Modal title="Add customer" onClose={() => setShowCustomer(false)}>
          <form className="stack" onSubmit={saveCustomer}>
            <Field label="Name">
              <Input value={newCustomer.name} onChange={(event) => setNewCustomer({ ...newCustomer, name: event.target.value })} required />
            </Field>
            <Field label="Phone">
              <Input value={newCustomer.phone} onChange={(event) => setNewCustomer({ ...newCustomer, phone: event.target.value })} />
            </Field>
            <label className="check">
              <input type="checkbox" checked={newCustomer.consent} onChange={(event) => setNewCustomer({ ...newCustomer, consent: event.target.checked })} />
              Customer agrees that we may keep these details
            </label>
            <p className="muted">Used for purchase records only. No marketing messages. A copy or deletion is available on request.</p>
            <Button type="submit">Save customer</Button>
          </form>
        </Modal>
      )}

      {sizeGroup && (
        <Modal title={`${sizeGroup.name} — select size`} onClose={() => setSizeGroup(null)}>
          <div className="stack">
            <p className="muted">{categoryLabel(sizeGroup.category)}. Pick the size the customer is buying.</p>
            <div className="size-picker">
              {sizeGroup.variants.map((variant) => {
                const record = pos.stockBySku[variant.sku];
                const qty = record ? Number(record.qty) : 0;
                const out = qty <= 0;
                const low = !out && record && qty <= Number(record.low_at);
                return (
                  <button
                    key={variant.id}
                    type="button"
                    className="size-chip size-chip-large"
                    disabled={out}
                    onClick={() => {
                      pos.addProduct(variant);
                      setSizeGroup(null);
                    }}
                  >
                    <strong>{variant.size || 'One size'}</strong>
                    <small>{money(variant.price)}</small>
                    <small>{out ? 'Out of stock' : low ? `Low · ${qty} left` : `${qty} left`}</small>
                  </button>
                );
              })}
            </div>
          </div>
        </Modal>
      )}

      {showConflicts && (
        <Modal title="Sales needing attention" onClose={() => setShowConflicts(false)}>
          <div className="stack">
            <p className="muted">
              These sales are saved on this device but were rejected by the server.
              Fix the cause, then retry or void the sale.
            </p>
            {!pos.conflicts.length && <p className="muted">No sales need attention now.</p>}
            {pos.conflicts.map((record) => {
              const shortfall = stockShortfall(record);
              const details = record.conflict?.details;
              const stockParams = new URLSearchParams({
                tab: 'Stock',
                sku: details?.sku || record.payload.items[0]?.sku || '',
                branchId: String(record.payload.branchId || ''),
                delta: String(shortfall || 1)
              });
              return (
                <div className="conflict" key={record.id}>
                  <div className="row-between">
                    <strong>{money(queuedTotal(record, pos.products))}</strong>
                    <Badge tone="warning">{record.conflict?.code || 'SYNC_FAILED'}</Badge>
                  </div>
                  <p className="conflict-items">
                    {(record.payload.items || []).map((item) => `${item.sku} × ${item.qty}`).join(', ')}
                  </p>
                  <p className="conflict-message">{record.conflict?.message}</p>
                  <small className="muted">
                    Saved {dateTime(record.createdAt)} · {record.attempts || 0} attempt{record.attempts === 1 ? '' : 's'}
                  </small>

                  {shortfall && (
                    <form className="stock-fix" onSubmit={(event) => addStock(event, record, shortfall)}>
                      <span className="muted">Short by {shortfall}. Add stock, then retry.</span>
                      <div className="row">
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          aria-label={`Quantity to add for ${details.sku}`}
                          value={fixQty[record.id] ?? shortfall}
                          onChange={(event) => setFixQty((current) => ({ ...current, [record.id]: event.target.value }))}
                        />
                        <Button type="submit" variant="secondary">Add stock</Button>
                        {user.role === 'admin' && (
                          <a className="btn btn-ghost" href={`/admin?${stockParams.toString()}`}>Stock screen</a>
                        )}
                      </div>
                    </form>
                  )}

                  <div className="row">
                    <Button onClick={() => pos.retryConflict(record.id)} disabled={pos.offline}>
                      Retry sale
                    </Button>
                    <Button variant="ghost" onClick={() => voidSale(record)}>Void sale</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
      )}
      {showScanner && (
        <ScannerModal
          title={scannerMode === 'receipt' ? 'Scan a receipt QR code' : 'Scan items'}
          hint={scannerMode === 'receipt'
            ? 'Point the camera at the QR code on a printed receipt to open it.'
            : 'Point the camera at a barcode or QR code. Each scan adds the item to the sale.'}
          onClose={() => setShowScanner(false)}
          onDetect={scannerMode === 'receipt'
            ? async (code) => { setShowScanner(false); await openReceipt(code); }
            : handleScan}
        />
      )}

      {receiptOpen && receiptData && (
        <ReceiptModal
          receipt={receiptData}
          companyName={pos.companyName}
          onClose={() => setReceiptOpen(false)}
        />
      )}
    </Shell>
  );
}
