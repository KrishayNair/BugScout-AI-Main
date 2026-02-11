/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exclude heavy Chroma packages from serverless bundle to stay under Vercel's 250 MB limit.
  // Chroma sync will no-op when the SDK isn't available (e.g. on Vercel).
  outputFileTracingExcludes: {
    "*": [
      "node_modules/chromadb",
      "node_modules/chromadb/**",
      "**/node_modules/chromadb/**",
      "node_modules/@chroma-core",
      "node_modules/@chroma-core/**",
      "**/node_modules/@chroma-core/**",
    ],
  },
};

export default nextConfig;
