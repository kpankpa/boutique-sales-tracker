'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '../viewmodels/useSession';
import { Button, Card, Field, Input } from './components/ui';

export default function LoginView() {
  const router = useRouter();
  const { user, loading, error, signIn } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [usePin, setUsePin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (!loading && user) {
      router.replace(user.role === 'admin' ? '/staff/admin' : '/staff/pos');
    }
  }, [loading, user, router]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setLocalError('');
    const signedIn = await signIn(
      usePin ? { username, pin } : { username, password }
    );
    if (signedIn) {
      router.replace(signedIn.role === 'admin' ? '/staff/admin' : '/staff/pos');
    }
    setBusy(false);
  };

  return (
    <div className="center-screen">
      <Card title="Sign in" subtitle="Use your staff username.">
        <form className="stack" onSubmit={submit}>
          <Field label="Username">
            <Input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoFocus required />
          </Field>

          {usePin ? (
            <Field label="PIN" hint="4 to 6 digits">
              <Input value={pin} onChange={(event) => setPin(event.target.value)} inputMode="numeric" required />
            </Field>
          ) : (
            <Field label="Password">
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
            </Field>
          )}

          <label className="check">
            <input type="checkbox" checked={usePin} onChange={(event) => setUsePin(event.target.checked)} />
            Sign in with PIN
          </label>

          {(localError || error) && (
            <p className="alert alert-error" role="alert">{localError || error}</p>
          )}

          <Button type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
