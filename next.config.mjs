/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["chromadb", "@chroma-core/default-embed"],
};

export default nextConfig;
