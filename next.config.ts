import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['192.168.45.85', '192.168.45.241', 'localhost'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://api:5174/api/:path*',
      },
    ];
  },
};

export default nextConfig;
