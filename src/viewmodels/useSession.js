'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost } from './api';

const warningWindowMs = 5 * 60 * 1000;

export function useSession() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expiresAt, setExpiresAt] = useState(null);
  const [sessionExpiring, setSessionExpiring] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await apiGet('/auth/me');
      setUser(data.user);
      setExpiresAt(data.expiresAt ?? null);
    } catch {
      setUser(null);
      setExpiresAt(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!expiresAt) {
      setSessionExpiring(false);
      return undefined;
    }
    const check = () => setSessionExpiring(Date.now() >= expiresAt - warningWindowMs);
    check();
    const timer = setInterval(check, 30 * 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const signIn = async (credentials) => {
    setError('');
    try {
      const data = await apiPost('/auth/login', credentials);
      setUser(data.user);
      setExpiresAt(null);
      await refresh();
      return data.user;
    } catch (failure) {
      setError(failure.message);
      return null;
    }
  };

  const signOut = async () => {
    await apiPost('/auth/logout', {});
    setUser(null);
    setExpiresAt(null);
    setSessionExpiring(false);
  };

  return { user, loading, error, sessionExpiring, signIn, signOut, refresh };
}
