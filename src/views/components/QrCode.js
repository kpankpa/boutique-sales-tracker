'use client';

import { useEffect, useState } from 'react';

// Renders a QR code as an image. The qrcode library is loaded on demand so it
// stays out of the main bundle until a label or receipt is actually shown.
export function QrCode({ value, size = 160, alt = 'QR code' }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let active = true;
    setSrc('');
    import('qrcode')
      .then((QRCode) => QRCode.toDataURL(String(value ?? ''), {
        width: size,
        margin: 1,
        errorCorrectionLevel: 'M'
      }))
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!src) return <div className="qr-placeholder" style={{ width: size, height: size }} aria-hidden="true" />;
  return <img className="qr-code" src={src} width={size} height={size} alt={alt} />;
}
