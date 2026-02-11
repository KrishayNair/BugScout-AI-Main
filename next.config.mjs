/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["chromadb", "@chroma-core/default-embed"],
  },
  // Exclude heavy Chroma packages from serverless bundle to stay under Vercel's 250 MB limit.
  // Chroma sync will no-op when the SDK isn't available (e.g. on Vercel); use a separate worker or DISABLE_CHROMA_SYNC=true if needed.
  outputFileTracingExcludes: {
    "*": [
      "node_modules/chromadb/**",
      "node_modules/@chroma-core/**",
    ],
  },
};

export default nextConfig;
