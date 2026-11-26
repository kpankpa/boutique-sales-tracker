'use client';

import { useRouter } from 'next/navigation';
import { useInstaller } from '../viewmodels/useInstaller';
import { Button, Card, Field, Input } from './components/ui';

const stepLabels = ['Welcome', 'Company', 'Admin', 'Finish'];

export default function InstallWizard() {
  const router = useRouter();
  const installer = useInstaller();
  const { step, form, busy, error, status } = installer;

  if (status?.installed) {
    return (
      <div className="center-screen">
        <Card title="Already installed" subtitle="This application has been set up.">
          <p className="muted">Sign in to continue.</p>
          <a className="btn btn-primary" href="/staff">Go to sign in</a>
        </Card>
      </div>
    );
  }

  return (
    <div className="center-screen">
      <div className="install">
        <header className="install-head">
          <span className="brand">SNEAKWISE</span>
          <h1>Set up Sneakwise</h1>
          <p>Four short steps. Nothing is sent anywhere.</p>
          <ol className="steps">
            {stepLabels.map((label, index) => (
              <li key={label} className={index === step ? 'active' : index < step ? 'done' : ''}>
                {label}
              </li>
            ))}
          </ol>
        </header>

        <Card>
          {step === 0 && (
            <div className="stack">
              <h2>Welcome</h2>
              <p className="muted">
                This wizard creates the database, your first branch and the admin account.
              </p>
              <div className="notice">
                {status ? (
                  <>
                    <strong>Environment ready.</strong> Database: {status.database}
                  </>
                ) : (
                  'Checking the environment…'
                )}
              </div>
              <Button onClick={installer.prepare} disabled={busy || !status}>
                {busy ? 'Preparing…' : 'Prepare database'}
              </Button>
            </div>
          )}

          {step === 1 && (
            <div className="stack">
              <h2>Company and branches</h2>
              <Field label="Company name">
                <Input value={form.companyName} onChange={(event) => installer.setCompanyName(event.target.value)} placeholder="Sneakwise" />
              </Field>

              {form.branches.map((branch, index) => (
                <div className="row" key={index}>
                  <Field label={`Branch ${index + 1} name`}>
                    <Input value={branch.name} onChange={(event) => installer.setBranchField(index, 'name', event.target.value)} placeholder="Accra Mall" />
                  </Field>
                  <Field label="Code" hint="Optional — generated from the name">
                    <Input value={branch.code} onChange={(event) => installer.setBranchField(index, 'code', event.target.value)} placeholder="ACCRA-MALL" />
                  </Field>
                  {form.branches.length > 1 && (
                    <Button variant="ghost" onClick={() => installer.removeBranch(index)}>Remove</Button>
                  )}
                </div>
              ))}

              <div className="row-between">
                <Button variant="secondary" onClick={() => installer.setStep(0)}>Back</Button>
                <div className="row">
                  <Button variant="ghost" onClick={installer.addBranch}>+ Add branch</Button>
                  <Button onClick={() => installer.setStep(2)}>Continue</Button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="stack">
              <h2>Admin account</h2>
              <p className="muted">The admin sees every branch and manages staff and products.</p>
              <Field label="Full name">
                <Input value={form.admin.name} onChange={(event) => installer.setAdminField('name', event.target.value)} />
              </Field>
              <Field label="Username">
                <Input value={form.admin.username} onChange={(event) => installer.setAdminField('username', event.target.value)} autoComplete="username" />
              </Field>
              <div className="row">
                <Field label="Password" hint="At least 8 characters">
                  <Input type="password" value={form.admin.password} onChange={(event) => installer.setAdminField('password', event.target.value)} autoComplete="new-password" />
                </Field>
                <Field label="Confirm password">
                  <Input type="password" value={form.admin.confirm} onChange={(event) => installer.setAdminField('confirm', event.target.value)} autoComplete="new-password" />
                </Field>
              </div>
              <div className="row-between">
                <Button variant="secondary" onClick={() => installer.setStep(1)}>Back</Button>
                <Button onClick={() => installer.setStep(3)}>Continue</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="stack">
              <h2>Finish setup</h2>
              <label className="check">
                <input type="checkbox" checked={form.seed} onChange={(event) => installer.setSeed(event.target.checked)} />
                Load sample products and customers
              </label>
              <div className="summary">
                <div><span>Company</span><strong>{form.companyName || '—'}</strong></div>
                <div><span>Branches</span><strong>{form.branches.filter((b) => b.name).length}</strong></div>
                <div><span>Admin</span><strong>{form.admin.username || '—'}</strong></div>
              </div>
              {error && <p className="alert alert-error" role="alert">{error}</p>}
              <div className="row-between">
                <Button variant="secondary" onClick={() => installer.setStep(2)}>Back</Button>
                <Button
                  disabled={busy}
                  onClick={async () => {
                    const done = await installer.finish();
                    if (done) router.replace('/staff');
                  }}
                >
                  {busy ? 'Installing…' : 'Finish installation'}
                </Button>
              </div>
            </div>
          )}

          {step < 3 && error && <p className="alert alert-error" role="alert">{error}</p>}
        </Card>
      </div>
    </div>
  );
}
