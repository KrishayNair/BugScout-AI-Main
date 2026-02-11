/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["chromadb", "@chroma-core/default-embed"],
  },
};

export default nextConfig;
