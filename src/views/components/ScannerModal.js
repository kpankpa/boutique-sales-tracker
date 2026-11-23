'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Field, Input, Modal } from './ui';

// Native BarcodeDetector format names.
const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'itf', 'codabar', 'qr_code'];
const SAME_CODE_COOLDOWN_MS = 2500;

function cameraErrorMessage(error) {
  const name = error?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera access was blocked. Allow the camera in your browser settings, or type the code below.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No camera was found on this device. Type the code below.';
  }
  if (name === 'NotReadableError') {
    return 'The camera is busy in another app. Close it and try again, or type the code below.';
  }
  return 'The camera could not be started (it needs HTTPS or localhost). Type the code below.';
}

function beep(audioRef) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!audioRef.current) audioRef.current = new AudioContext();
    const context = audioRef.current;
    if (context.state === 'suspended') context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = 1046;
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.12);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.13);
  } catch {
    // Sound is a nice-to-have; scanning must never fail because of it.
  }
}

export function ScannerModal({ title = 'Scan barcode or QR code', hint, onDetect, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const controlsRef = useRef(null);
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const cooldownRef = useRef(new Map());
  const detectRef = useRef(onDetect);
  detectRef.current = onDetect;

  const [status, setStatus] = useState('starting');
  const [cameraError, setCameraError] = useState('');
  const [lastCode, setLastCode] = useState('');
  const [scanCount, setScanCount] = useState(0);
  const [flash, setFlash] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    let cancelled = false;

    const handleCode = (raw) => {
      const code = String(raw || '').trim();
      if (!code) return;
      const now = Date.now();
      const lastSeen = cooldownRef.current.get(code) || 0;
      if (now - lastSeen < SAME_CODE_COOLDOWN_MS) return;
      cooldownRef.current.set(code, now);
      beep(audioRef);
      setLastCode(code);
      setScanCount((count) => count + 1);
      setFlash(true);
      window.setTimeout(() => setFlash(false), 220);
      detectRef.current(code);
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('error');
        setCameraError('This browser cannot open the camera here. Type the code below.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play().catch(() => {});

        const track = stream.getVideoTracks()[0];
        if (track?.getCapabilities?.().torch) setTorchSupported(true);

        if ('BarcodeDetector' in window) {
          const supported = await window.BarcodeDetector.getSupportedFormats().catch(() => []);
          const formats = NATIVE_FORMATS.filter((format) => supported.includes(format));
          const detector = new window.BarcodeDetector(formats.length ? { formats } : {});
          const tick = async () => {
            if (cancelled) return;
            try {
              if (video.readyState >= 2) {
                const codes = await detector.detect(video);
                if (codes.length) handleCode(codes[0].rawValue);
              }
            } catch {
              // A bad frame should never stop the scan loop.
            }
            if (!cancelled) timerRef.current = window.setTimeout(tick, 150);
          };
          tick();
        } else {
          // Safari and older browsers: lazy-load the ZXing decoder.
          const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
            import('@zxing/browser'),
            import('@zxing/library')
          ]);
          if (cancelled) return;
          const hints = new Map();
          hints.set(DecodeHintType.TRY_HARDER, true);
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
            BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.ITF,
            BarcodeFormat.CODABAR, BarcodeFormat.QR_CODE
          ]);
          const reader = new BrowserMultiFormatReader(hints);
          controlsRef.current = await reader.decodeFromStream(stream, video, (result) => {
            if (result) handleCode(result.getText());
          });
        }
        if (!cancelled) setStatus('scanning');
      } catch (error) {
        if (!cancelled) {
          setStatus('error');
          setCameraError(cameraErrorMessage(error));
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      controlsRef.current?.stop?.();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      audioRef.current?.close?.().catch(() => {});
    };
  }, []);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  };

  const submitManual = (event) => {
    event.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    setManualCode('');
    detectRef.current(code);
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="stack">
        <div className={flash ? 'scan-stage scan-flash' : 'scan-stage'}>
          <video ref={videoRef} className="scan-video" muted playsInline aria-label="Camera preview" />
          <div className="scan-frame" aria-hidden="true" />
          {status === 'starting' && <p className="scan-status">Starting camera…</p>}
          {status === 'error' && <p className="scan-status scan-status-error">{cameraError}</p>}
        </div>

        <div className="row-between">
          <p className="muted scan-hint">
            {hint || 'Point the camera at a barcode or QR code. Each scan is added straight away.'}
          </p>
          {torchSupported && (
            <Button variant="secondary" onClick={toggleTorch} aria-pressed={torchOn}>
              {torchOn ? 'Light off' : 'Light on'}
            </Button>
          )}
        </div>

        {lastCode && (
          <p className="scan-last" role="status">
            Scanned <strong>{lastCode}</strong> · {scanCount} scan{scanCount === 1 ? '' : 's'} this session
          </p>
        )}

        <form className="row" onSubmit={submitManual}>
          <Field label="Or type the code">
            <Input
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              placeholder="Barcode / item code"
              aria-label="Type a barcode or item code"
            />
          </Field>
          <Button type="submit" variant="secondary">Add code</Button>
        </form>

        <div className="row">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
}
