'use client';

import { useEffect, useMemo, useState } from 'react';

export function Button({ children, variant = 'primary', className = '', ...props }) {
  return (
    <button className={`btn btn-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children, required = false }) {
  const childRequired = required || Boolean(children?.props?.required);
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {childRequired ? <span className="field-required" aria-hidden="true"> *</span> : null}
      </span>
      {children}
      {error ? <span className="field-error" role="status">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Input({ className = '', ...props }) {
  return <input className={`input ${className}`} {...props} />;
}

export function Select({ children, ...props }) {
  return (
    <select className="input" {...props}>
      {children}
    </select>
  );
}

export function Card({ title, subtitle, actions, children }) {
  return (
    <section className="card">
      {(title || actions) && (
        <header className="card-head">
          <div>
            {title && <h2 className="card-title">{title}</h2>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Badge({ tone = 'neutral', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function DataTable({ columns, rows, empty = 'Nothing to show yet.', sortable = false }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const sortedRows = useMemo(() => {
    if (!sortable || !sortKey) return rows;
    const column = columns.find((entry) => entry.key === sortKey);
    const valueOf = (row) => column?.sortValue ? column.sortValue(row) : row[sortKey];
    return [...rows].sort((a, b) => {
      const left = valueOf(a);
      const right = valueOf(b);
      if (left == null && right == null) return 0;
      if (left == null) return 1;
      if (right == null) return -1;
      const result = typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right), undefined, { numeric: true });
      return sortDir === 'asc' ? result : -result;
    });
  }, [rows, columns, sortKey, sortDir, sortable]);

  if (!rows.length) return <EmptyState message={empty} />;

  const toggleSort = (key) => {
    if (!sortable) return;
    if (sortKey === key) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {sortable && column.label ? (
                  <button type="button" className="table-sort" onClick={() => toggleSort(column.key)} aria-label={`Sort by ${column.label}`}>
                    {column.label}
                    <span className={sortKey === column.key ? 'sort-indicator active' : 'sort-indicator'}>
                      {sortKey === column.key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                    </span>
                  </button>
                ) : column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, index) => (
            <tr key={row.id ?? index}>
              {columns.map((column) => (
                <td key={column.key} data-label={column.label || ''}>{column.render ? column.render(row) : row[column.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyState({ title, message }) {
  return (
    <div className="empty">
      {title && <strong>{title}</strong>}
      <p>{message}</p>
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <header className="modal-head">
          <h2>{title}</h2>
          <Button variant="ghost" onClick={onClose} aria-label="Close dialog">
            ×
          </Button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function Shell({ user, onSignOut, links = [], sessionExpiring = false, children }) {
  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <span className="brand">SLAWN POS</span>
          <span className="topbar-sub">{user?.name}</span>
        </div>
        <nav className="topnav">
          {links.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
          <Button variant="ghost" onClick={onSignOut}>
            Sign out
          </Button>
        </nav>
      </header>
      <main className="main">
        {sessionExpiring && (
          <div className="alert alert-warn" role="status">
            Your session will expire soon. Save your work — you may need to sign in again.
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
