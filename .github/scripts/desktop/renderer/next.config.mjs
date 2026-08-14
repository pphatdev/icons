import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  // Static export loaded via file:// in Electron — asset paths must be relative
  assetPrefix: process.env.NODE_ENV === 'production' ? './' : undefined,
  // Pin the workspace root to renderer/ so Next.js stops guessing between the
  // three lockfiles (repo root, desktop/, desktop/renderer/).
  outputFileTracingRoot: __dirname,
};
export default nextConfig;
