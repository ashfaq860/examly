import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Re-enable type and lint checks at build time so errors surface early.
  // Remove these two blocks if you need a quick escape hatch during development.
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // Supabase storage
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      // Google user avatars (OAuth profile pictures)
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      // SVG icon CDN used for the Google login button
      {
        protocol: 'https',
        hostname: 'www.svgrepo.com',
      },
    ],
  },

  // Optimised package imports for better tree-shaking
  experimental: {
    optimizePackageImports: ['lucide-react', 'react-icons', 'framer-motion'],
  },
};

export default nextConfig;
