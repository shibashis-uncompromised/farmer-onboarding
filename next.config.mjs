/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",            // static export → hostable anywhere, works offline
  images: { unoptimized: true },
  reactStrictMode: true,
  trailingSlash: true,
};

export default nextConfig;
