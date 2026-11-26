'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '../../viewmodels/useSession';
import { Card, Shell } from '../components/ui';

const steps = [
  {
    title: 'Read the order reference',
    body: 'Every WhatsApp handoff includes a Ref such as SW-260411-A1B2. Quote it back so the customer knows you are handling that request.'
  },
  {
    title: 'Check live stock',
    body: 'Storefront availability is a summed signal, not a reservation. Check the exact size in the branch you will serve from before confirming.'
  },
  {
    title: 'Confirm delivery and payment',
    body: 'Use the structured choices in the message. Agree payment only after stock is confirmed. Never ask for card numbers or MoMo PINs in chat.'
  },
  {
    title: 'Record one POS sale',
    body: 'Open /staff/pos, create the sale with the correct branch, cashier, items and payment method. Add the WhatsApp ref to the note if your branch uses one.'
  },
  {
    title: 'Close the loop',
    body: 'Send the receipt or confirmation in WhatsApp. If the pair is no longer available, apologise, offer the next size and do not record a sale.'
  }
];

export default function StaffSopView() {
  const router = useRouter();
  const { user, loading, signOut, sessionExpiring } = useSession();

  useEffect(() => {
    if (!loading && !user) router.replace('/staff');
  }, [loading, user, router]);

  if (loading) return <div className="center-screen"><p>Loading…</p></div>;
  if (!user) return null;

  return (
    <Shell
      user={user}
      onSignOut={signOut}
      sessionExpiring={sessionExpiring}
      links={[
        { href: '/staff/pos', label: 'POS' },
        ...(user.role === 'admin' ? [{ href: '/staff/admin', label: 'Admin' }] : []),
        { href: '/staff/sop', label: 'Order SOP' }
      ]}
    >
      <div className="page-head">
        <div>
          <p className="eyebrow">Staff guide</p>
          <h1>WhatsApp order SOP</h1>
          <p className="muted">The storefront takes requests. Staff confirm and record the sale.</p>
        </div>
      </div>

      <div className="stack">
        <Card title="Five-step confirmation flow">
          <ol className="shop-sop">
            {steps.map((step) => (
              <li key={step.title}><strong>{step.title}.</strong> {step.body}</li>
            ))}
          </ol>
        </Card>

        <Card title="Safety rules" subtitle="Non-negotiable for every order.">
          <ul className="shop-sop-rules">
            <li>Never request a card number, CVV, MoMo PIN or one-time password in WhatsApp.</li>
            <li>Never create a sale before stock and payment are confirmed.</li>
            <li>Never treat the storefront badge as a stock reservation.</li>
            <li>Never create a customer just because a WhatsApp message arrived.</li>
            <li>One confirmed bag becomes one POS sale, not one sale per chat message.</li>
          </ul>
        </Card>

        <Card title="Quick links">
          <div className="row">
            <a className="btn btn-primary" href="/staff/pos">Open POS</a>
            {user.role === 'admin' && <a className="btn btn-secondary" href="/staff/admin?tab=Insights">View storefront insights</a>}
            <a className="btn btn-ghost" href="/shop" target="_blank" rel="noopener noreferrer">Preview storefront ↗</a>
          </div>
        </Card>
      </div>
    </Shell>
  );
}
