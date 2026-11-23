'use client';

import { useState } from 'react';
import { prepareProductImage, uploadProductImage } from '../../viewmodels/productImages';
import { Button } from './ui';

// Reusable photo picker for both the add-product form and inline table edit.
// The image is resized and uploaded as soon as it is chosen; onChange receives
// the final stored value (a data URL or an S3 URL) so it can be saved with the
// product in one request.
export function ImagePicker({ value = '', onChange, onError, compact = false }) {
  const [busy, setBusy] = useState(false);

  const choose = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const blob = await prepareProductImage(file);
      onChange(await uploadProductImage(blob));
      onError?.('');
    } catch (failure) {
      onError?.(failure.message || 'The image could not be uploaded.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={compact ? 'image-picker compact' : 'image-picker'}>
      {value ? (
        <img className="image-preview" src={value} alt="Product preview" />
      ) : (
        <div className="image-preview image-empty" aria-hidden="true">No photo</div>
      )}
      <div className="row">
        <label className="btn btn-secondary image-upload-button">
          {busy ? 'Uploading…' : 'Choose photo'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={choose}
            disabled={busy}
            hidden
          />
        </label>
        {value && (
          <Button type="button" variant="ghost" onClick={() => onChange('')} disabled={busy}>
            Remove
          </Button>
        )}
      </div>
      {!compact && <small className="muted">JPEG, PNG or WebP. Resized to 900px before saving.</small>}
    </div>
  );
}
