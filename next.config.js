/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
};
module.exports = nextConfig;
