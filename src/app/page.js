'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet } from '../viewmodels/api';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    apiGet('/status')
      .then((status) => {
        if (!status.installed) return router.replace('/install');
        return router.replace('/shop');
      })
      .catch(() => router.replace('/install'));
  }, [router]);

  return <div className="center-screen"><p>Opening Sneakwise…</p></div>;
}
