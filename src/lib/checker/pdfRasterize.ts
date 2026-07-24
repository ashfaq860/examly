// Rasterizes an uploaded PDF into one JPEG buffer per page, so a PDF
// submission produces the exact same scan_urls[] shape as camera/file
// uploads — everything downstream (grade-mcq, grade-subjective) is then
// source-agnostic and never needs to know a page came from a PDF.
//
// Was `mupdf` — replaced entirely. mupdf was AGPL-3.0-or-later (confirmed
// in its own package.json), unusable in this commercial SaaS, and its WASM
// binding was throwing "_ is not a function" at runtime.
//
// Primary: @hyzyla/pdfium (MIT — a WASM build of Google's PDFium, the
// engine Chrome itself uses), rendered to raw RGBA and JPEG-encoded via
// sharp (already a dep elsewhere in this codebase).
// Fallback: pdfjs-dist (Apache-2.0) + @napi-rs/canvas (MIT) — used only if
// pdfium fails to load or render for any reason. This keeps a single bad
// WASM instantiation (or any other pdfium hiccup) from 400-ing the whole
// submission: the second implementation gets a full independent attempt
// before this function actually gives up.
//
// Both are imported dynamically inside their own function, not statically
// at module scope — a WASM/native module instantiated eagerly on import
// breaks Next.js's build step (it evaluates route modules during
// "Collecting page data", well before any real request exists to actually
// rasterize a PDF for). A dynamic import defers that instantiation to the
// first real call, at request time — same fix shape as claude.ts's lazy
// client for the same class of issue.

async function rasterizeWithPdfium(buffer: Buffer, scale: number): Promise<Buffer[]> {
  const { PDFiumLibrary } = await import('@hyzyla/pdfium');
  const sharp = (await import('sharp')).default;

  const library = await PDFiumLibrary.init();
  try {
    const document = await library.loadDocument(new Uint8Array(buffer));
    try {
      const images: Buffer[] = [];
      for (const page of document.pages()) {
        const rendered = await page.render({
          scale,
          // pdfium hands back raw RGBA bytes here (its "BGRA" colorSpace
          // option is reversed at the byte level by REVERSE_BYTE_ORDER,
          // so despite the name the buffer is already RGBA) — sharp
          // encodes straight to JPEG from that, no channel swap needed.
          render: async ({ data, width, height }) =>
            sharp(data, { raw: { width, height, channels: 4 } }).jpeg({ quality: 85 }).toBuffer(),
        });
        images.push(Buffer.from(rendered.data));
      }
      return images;
    } finally {
      document.destroy();
    }
  } finally {
    library.destroy();
  }
}

async function rasterizeWithPdfjs(buffer: Buffer, scale: number): Promise<Buffer[]> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { createCanvas } = await import('@napi-rs/canvas');

  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });

  try {
    const doc = await loadingTask.promise;
    const images: Buffer[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      try {
        const viewport = page.getViewport({ scale });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const context = canvas.getContext('2d');
        // @napi-rs/canvas is pdfjs-dist's own blessed Node canvas backend
        // (it's an optional dep of pdfjs-dist itself) — its 2D API surface
        // matches the DOM types pdfjs expects, just not nominally, hence
        // the casts.
        await page.render({
          canvas: canvas as unknown as HTMLCanvasElement,
          canvasContext: context as unknown as CanvasRenderingContext2D,
          viewport,
        }).promise;
        images.push(await canvas.encode('jpeg', 85));
      } finally {
        page.cleanup();
      }
    }
    return images;
  } finally {
    await loadingTask.destroy();
  }
}

/** Renders every page of `buffer` (a PDF) to a JPEG at roughly `dpi`
 *  (PDF's native unit is 1/72in, so scale = dpi/72), in page order. */
export async function rasterizePdfToImages(buffer: Buffer, dpi = 200): Promise<Buffer[]> {
  const scale = dpi / 72;
  try {
    return await rasterizeWithPdfium(buffer, scale);
  } catch (pdfiumErr: any) {
    console.warn(`[PDF-RASTERIZE] pdfium failed to load/render (${pdfiumErr?.message || pdfiumErr}) — falling back to pdfjs-dist + @napi-rs/canvas`);
    try {
      return await rasterizeWithPdfjs(buffer, scale);
    } catch (pdfjsErr: any) {
      throw new Error(`Could not rasterize PDF — pdfium: ${pdfiumErr?.message || pdfiumErr}; pdfjs-dist fallback: ${pdfjsErr?.message || pdfjsErr}`);
    }
  }
}
