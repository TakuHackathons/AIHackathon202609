import path from 'node:path';
import { fileURLToPath } from 'node:url';
const basePath = process.env.BASE_PATH || '';
const nextConfig = {
  output: 'export',
  turbopack: { root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..') },
  reactStrictMode: false,
  assetPrefix: basePath,
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  trailingSlash: true,
  ...(process.env.NODE_ENV === 'development'
    ? {
        async rewrites() {
          return [{ source: '/api/:path*', destination: 'http://127.0.0.1:8787/api/:path*' }];
        },
      }
    : {}),
};
export default nextConfig;
