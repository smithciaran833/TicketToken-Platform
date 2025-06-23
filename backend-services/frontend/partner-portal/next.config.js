/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['cdn.tickettoken.io', 'preview.tickettoken.io'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3002/api/:path*', // Tenant service
      },
    ];
  },
};

module.exports = nextConfig;
