// Live in-app camera capture via getUserMedia — a real camera preview and
// shutter button, rather than relying on the <input capture> attribute
// (which many desktop browsers, e.g. Firefox, simply ignore and fall back
// to a plain file picker with no camera at all). Stays open across
// multiple captures so the teacher can keep photographing pages/students
// back-to-back without re-opening it each time; only closes on explicit
// "Done".
'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Camera as CameraIcon } from 'lucide-react';

export function CameraCapture({
  pageCount,
  onCapture,
  onClose,
}: {
  pageCount: number;
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser does not support in-app camera capture — use "Choose files" instead.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setReady(true);
      } catch (err: any) {
        setError(err.name === 'NotAllowedError'
          ? 'Camera permission was denied — allow camera access, or use "Choose files" instead.'
          : (err.message || 'Could not access the camera.'));
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!blob) return;
      onCapture(new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      setFlash(true);
      setTimeout(() => setFlash(false), 150);
    }, 'image/jpeg', 0.92);
  };

  return (
    <div className="chk-cam-overlay">
      <div className="chk-cam-box">
        <div className="chk-cam-topbar">
          <span className="chk-cam-count">{pageCount} page{pageCount === 1 ? '' : 's'} captured</span>
          <button type="button" className="chk-cam-close" onClick={onClose}><X size={20} /> Done</button>
        </div>

        {error ? (
          <div className="chk-cam-error">{error}</div>
        ) : (
          <div className="chk-cam-frame">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} className="chk-cam-video" playsInline muted />
            {flash && <div className="chk-cam-flash" />}
          </div>
        )}

        <div className="chk-cam-controls">
          <button type="button" className="chk-cam-shutter" onClick={capture} disabled={!ready} aria-label="Capture page">
            <CameraIcon size={24} />
          </button>
        </div>
      </div>

      <style jsx>{`
        .chk-cam-overlay {
          position: fixed; inset: 0; background: #0b0f1e; z-index: 2000;
          display: flex; align-items: center; justify-content: center; padding: 1rem;
        }
        .chk-cam-box { width: 100%; max-width: 480px; display: flex; flex-direction: column; gap: 1rem; }
        .chk-cam-topbar { display: flex; align-items: center; justify-content: space-between; color: #fff; }
        .chk-cam-count { font-size: 0.85rem; opacity: 0.85; }
        .chk-cam-close {
          display: inline-flex; align-items: center; gap: 4px; background: none; border: none; color: #fff;
          font-weight: 700; font-size: 0.9rem; cursor: pointer; padding: 4px;
        }
        .chk-cam-frame { position: relative; border-radius: var(--chk-radius-lg); overflow: hidden; background: #000; }
        .chk-cam-video { width: 100%; max-height: 65vh; display: block; object-fit: cover; }
        .chk-cam-flash { position: absolute; inset: 0; background: #fff; animation: chk-cam-flash-fade 0.15s ease-out; }
        @keyframes chk-cam-flash-fade { from { opacity: 0.85; } to { opacity: 0; } }
        .chk-cam-error { color: #fca5a5; text-align: center; padding: 2.5rem 1rem; font-size: 0.9rem; }
        .chk-cam-controls { display: flex; justify-content: center; }
        .chk-cam-shutter {
          width: 68px; height: 68px; border-radius: 50%; border: 4px solid #fff; background: var(--chk-accent);
          color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .chk-cam-shutter:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
