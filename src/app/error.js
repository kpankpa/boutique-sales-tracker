'use client';

import { useEffect } from 'react';
import { Button } from '../views/components/ui';

export default function Error({ error, retry }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="center-screen">
      <div className="install">
        <section className="card">
          <h1 className="card-title">Something went wrong</h1>
          <p className="muted">
            This page could not be loaded. Your sales and customer records are safe.
          </p>
          <Button onClick={retry}>Try again</Button>
        </section>
      </div>
    </div>
  );
}
