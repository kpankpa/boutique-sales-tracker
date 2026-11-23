'use client';

import { money, dateTime } from '../format';
import { displayProductName } from '../../models/productOptions';
import { Button, Modal } from './ui';
import { QrCode } from './QrCode';

// Accepts both the server receipt shape (snake_case, from /sales/receipt)
// and the fresh-sale shape built by usePos after checkout.
export function ReceiptModal({ receipt, companyName = 'Slawn POS', onClose }) {
  const receiptNo = receipt.receiptNo ?? receipt.receipt_no;
  const lines = receipt.lines ?? [];
  const subtotal = Number(receipt.subtotal ?? lines.reduce((sum, line) => sum + Number(line.line_total ?? 0), 0));
  const discount = Number(receipt.discount ?? 0);
  const total = Number(receipt.total ?? subtotal - discount);
  const payment = receipt.payment_method ?? receipt.paymentMethod ?? '';
  const branch = receipt.branch_name ?? receipt.branchName ?? '';
  const cashier = receipt.cashier_name ?? receipt.cashierName ?? '';
  const customer = receipt.customer_name ?? receipt.customerName ?? '';
  const createdAt = receipt.created_at ?? receipt.createdAt ?? new Date().toISOString();

  return (
    <Modal title={`Receipt ${receiptNo}`} onClose={onClose}>
      <div className="print-area receipt">
        <header className="receipt-head">
          <strong>{companyName}</strong>
          <span>Receipt {receiptNo}</span>
          <span>{dateTime(createdAt)}</span>
          {branch && <span>{branch}</span>}
          {cashier && <span>Served by {cashier}</span>}
          {customer && <span>Customer: {customer}</span>}
        </header>

        <table className="receipt-lines">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const name = line.name_snapshot ?? line.name;
              const size = line.size_snapshot ?? line.size;
              const qty = Number(line.qty);
              const price = Number(line.unit_price ?? line.price);
              const lineTotal = Number(line.line_total ?? price * qty);
              return (
                <tr key={index}>
                  <td>{displayProductName(name, size)}<br /><small>{line.sku_snapshot ?? line.sku}</small></td>
                  <td>{qty}</td>
                  <td>{money(price)}</td>
                  <td>{money(lineTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="receipt-totals">
          <span>Subtotal</span><span>{money(subtotal)}</span>
          {discount > 0 && (<><span>Discount</span><span>-{money(discount)}</span></>)}
          <span className="receipt-grand">Total</span>
          <span className="receipt-grand">{money(total)}</span>
          {payment && (<><span>Payment</span><span className="receipt-payment">{payment}</span></>)}
        </div>

        <div className="receipt-qr">
          <QrCode value={receiptNo} size={120} alt={`QR code for receipt ${receiptNo}`} />
          <small>Scan to look up this receipt</small>
        </div>

        <p className="receipt-foot">Thank you for your purchase. Goods sold are subject to the store&apos;s return policy.</p>
      </div>

      <div className="row no-print">
        <Button onClick={() => window.print()}>Print receipt</Button>
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}
