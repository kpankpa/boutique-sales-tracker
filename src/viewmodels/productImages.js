'use client';

import { apiPost } from './api';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const MAX_EDGE = 900;
const JPEG_QUALITY = 0.82;

// Shrink photos in the browser before they ever leave the device. Product
// shots only need ~900px and a small JPEG, which keeps inline storage sane
// and makes S3 uploads fast on mobile data.
export async function prepareProductImage(file) {
  if (!file || !ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Choose a JPEG, PNG or WebP image.');
  }
  if (file.size > MAX_SOURCE_BYTES) throw new Error('Choose an image smaller than 10 MB.');

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('That image could not be opened.'));
      image.src = objectUrl;
    });
    const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error('That image could not be processed.')), 'image/jpeg', JPEG_QUALITY);
    });
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('That image could not be encoded.'));
    reader.readAsDataURL(blob);
  });
}

// Returns the value to store in products.image_url. With S3 configured the
// browser PUTs directly to the bucket; without it a compressed data URL is
// sent with the product payload instead.
export async function uploadProductImage(blob) {
  const signed = await apiPost('/uploads/presign', { contentType: blob.type, size: blob.size });
  if (signed.mode === 'inline') {
    const dataUrl = await blobToDataUrl(blob);
    if (dataUrl.length > 500000) throw new Error('That image is too large. Try a smaller photo.');
    return dataUrl;
  }

  const response = await fetch(signed.url, {
    method: 'PUT',
    headers: signed.headers,
    body: blob
  });
  if (!response.ok) throw new Error('The image upload failed. Check the S3 bucket settings.');
  return signed.publicUrl;
}
