/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@pulse/shared"],
  typedRoutes: false,
};

export default nextConfig;
