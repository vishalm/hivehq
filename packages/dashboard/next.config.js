/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['@hive/shared'],
  experimental: {
    typedRoutes: true,
  },
}

export default nextConfig
