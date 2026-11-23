'use client';

import { useEffect, useRef } from 'react';

// USB/Bluetooth barcode scanners behave like keyboards: they type the code
// very fast and finish with Enter (or Tab). Humans type much slower, so a
// burst of >= minLength characters with tiny gaps is treated as a scan.
const MAX_KEY_GAP_MS = 150; // slower than this between keys = human typing
const SCAN_WINDOW_MS = 1500; // whole code must arrive within this window
const TERMINATOR_GAP_MS = 300; // Enter/Tab must follow the last key quickly

function isTextInput(element) {
  return element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA');
}

function isInteractive(element) {
  return Boolean(element?.closest?.('input, textarea, select, button, a, [role="button"], [contenteditable="true"]'));
}

export function useBarcodeScanner(onScan, { enabled = true, minLength = 4 } = {}) {
  const handler = useRef(onScan);
  handler.current = onScan;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    let buffer = '';
    let stamps = [];
    let lastKeyAt = 0;

    const reset = () => {
      buffer = '';
      stamps = [];
    };

    const onKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const now = performance.now();
      const target = event.target;

      if (event.key === 'Enter' || event.key === 'Tab') {
        const recent = stamps.filter((stamp) => now - stamp <= SCAN_WINDOW_MS);
        const isBurst = recent.length >= minLength && now - lastKeyAt <= TERMINATOR_GAP_MS;
        if (isBurst) {
          // In a text field the scanner already typed the code; elsewhere we
          // buffered it ourselves.
          const code = (isTextInput(target) ? String(target.value || '') : buffer).trim();
          if (code.length >= minLength) {
            event.preventDefault();
            event.stopPropagation();
            reset();
            handler.current(code, target);
            return;
          }
        }
        reset();
        return;
      }

      if (event.key.length !== 1) return; // Shift, arrows, F-keys, ...

      // Leave buttons, links and product cards alone so keyboard navigation
      // (Enter/Space) keeps working.
      if (isInteractive(target) && !isTextInput(target)) {
        reset();
        return;
      }

      if (now - lastKeyAt > MAX_KEY_GAP_MS) reset();
      lastKeyAt = now;
      stamps.push(now);

      if (!isTextInput(target)) {
        buffer += event.key;
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, minLength]);
}
