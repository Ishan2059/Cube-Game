/** @type {import('next').NextConfig} */
const nextConfig = {
  // allow phones/other LAN devices to hit the dev server without the
  // cross-origin /_next/* warning (dev-only setting, ignored in prod)
  allowedDevOrigins: ["192.168.1.8", "localhost", "127.0.0.1"],
};

export default nextConfig;
