/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Port the Vite dev proxy to Next.js rewrites for local development.
  // Socket.IO connects directly via NEXT_PUBLIC_API_URL (rewrites can't upgrade WebSockets).
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || process.env.VITE_API_URL || 'http://localhost:5000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },

  poweredByHeader: false,
};

module.exports = nextConfig;
