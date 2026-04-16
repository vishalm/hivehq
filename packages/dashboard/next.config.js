/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@hive/shared'],
  experimental: {
    typedRoutes: true,
  },
}

export default nextConfig
