export function Button({ children, variant = 'primary', className = '', ...props }) {
  return (
    <button className={`btn btn-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
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

export function DataTable({ columns, rows, empty = 'Nothing to show yet.' }) {
  if (!rows.length) return <EmptyState message={empty} />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id ?? index}>
              {columns.map((column) => (
                <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>
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
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <header className="modal-head">
          <h2>{title}</h2>
          <Button variant="ghost" onClick={onClose} aria-label="Close">
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
