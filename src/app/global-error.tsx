'use client';

import { useEffect } from 'react';
import { isChunkLoadError, reloadForChunkError } from '@/lib/chunkErrorReload';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const isChunkError = isChunkLoadError(error);

  useEffect(() => {
    if (isChunkError) reloadForChunkError();
  }, [isChunkError]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            gap: '1rem',
            fontFamily: 'sans-serif',
            textAlign: 'center',
            padding: '1rem',
          }}
        >
          <p>{isChunkError ? 'Updating to the latest version…' : 'Something went wrong.'}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '9999px',
              border: '1px solid #ccc',
              background: 'white',
              cursor: 'pointer',
            }}
          >
            Reload page
          </button>
        </div>
      </body>
    </html>
  );
}
