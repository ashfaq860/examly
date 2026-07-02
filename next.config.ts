import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
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
    ];
  },
};

export default nextConfig;
