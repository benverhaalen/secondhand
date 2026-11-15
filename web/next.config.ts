import type { NextConfig } from 'next';
import path from 'node:path';
const config: NextConfig = {
  turbopack: { root: path.resolve(process.cwd(), '..') },
  async rewrites() {
    const origin = process.env.SECONDHAND_API_ORIGIN?.replace(/\/$/, '');
    return origin ? [{ source: '/v1/:path*', destination: `${origin}/v1/:path*` }] : [];
  },
};
export default config;
