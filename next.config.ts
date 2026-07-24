import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // sharp (used by the /api/checker/grade-mcq OMR pipeline) ships native
  // binaries — keep it external to the server bundle instead of letting
  // webpack try to bundle it. Same reasoning for the PDF rasterizer's
  // libraries: @hyzyla/pdfium loads its .wasm file from a path relative to
  // its own __dirname at runtime, and @napi-rs/canvas ships a native
  // addon — both break if webpack bundles them into a different directory
  // than where their binary actually lives on disk.
  serverExternalPackages: ['sharp', '@hyzyla/pdfium', 'pdfjs-dist', '@napi-rs/canvas'],
  // 🚀 Performance optimizations
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
  // Experimental: Optimized package imports for better tree-shaking
  experimental: {
    optimizePackageImports: ['lucide-react', 'react-icons'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Prevent the site from being framed by another origin (clickjacking)
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Stop browsers from MIME-sniffing a response away from its declared Content-Type
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Don't leak the full referring URL (which can contain ids/tokens) to third parties
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Disable browser features this app doesn't use
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Force HTTPS on repeat visits
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
      {
        // Static assets served from /public - long-lived cache since they're
        // only updated by replacing the deployment, not by URL versioning
        source: '/:all*(svg|jpg|jpeg|png|webp|avif|ico|woff|woff2|ttf)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
