'use client';

import { useEffect } from 'react';

export default function ServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // The app still works online if registration is unavailable.
      });
    }
  }, []);
  return null;
}
