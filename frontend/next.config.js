/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Port the Vite dev proxy to Next.js rewrites for local development.
  // Socket.IO connects directly via NEXT_PUBLIC_API_URL (rewrites can't upgrade WebSockets).
  async rewrites() {
    return process.env.NODE_ENV === 'development'
      ? [
          {
            source: '/api/:path*',
            destination: 'http://localhost:5000/api/:path*',
          },
          {
            source: '/uploads/:path*',
            destination: 'http://localhost:5000/uploads/:path*',
          },
        ]
      : [];
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
