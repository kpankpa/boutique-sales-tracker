'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet } from '../viewmodels/api';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    Promise.all([apiGet('/status'), apiGet('/auth/me')])
      .then(([status, session]) => {
        if (!status.installed) return router.replace('/install');
        if (!session.user) return router.replace('/login');
        return router.replace(session.user.role === 'admin' ? '/admin' : '/pos');
      })
      .catch(() => router.replace('/install'));
  }, [router]);

  return <div className="center-screen"><p>Opening Sneakwise POS…</p></div>;
}
