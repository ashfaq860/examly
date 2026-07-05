'use client';

import { useEffect } from 'react';
import { isChunkLoadError, reloadForChunkError } from '@/lib/chunkErrorReload';

// Chunk-load failures during client-side navigation surface as an
// unhandled promise rejection (or a plain window error) rather than a
// React render error, so global-error.tsx's boundary alone won't catch
// them — this listens at the window level as a second net.
export default function ChunkErrorReload() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error)) reloadForChunkError();
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) reloadForChunkError();
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
