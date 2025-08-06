/**** next.config.js ****/
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove deprecated experimental.appDir (Next 14+ uses /app by default)
  experimental: {
  },
  reactStrictMode: true
};

module.exports = nextConfig;