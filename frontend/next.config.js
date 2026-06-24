const fs = require('fs');
const path = require('path');

// Read and parse root .env into a local object (do not touch Node's global process.env)
const rootEnv = {};
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex > 0) {
      const key = trimmed.slice(0, separatorIndex).trim();
      let val = trimmed.slice(separatorIndex + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      rootEnv[key] = val;
    }
  });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { domains: ['localhost'] },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    webpackBuildWorker: false,
  },
  webpack: (config, { dev }) => {
    if (!dev) {
      config.devtool = false;
      config.parallelism = 2;
    }
    return config;
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || rootEnv.NEXT_PUBLIC_API_URL || `http://localhost:${process.env.PORT || rootEnv.PORT || '5000'}`,
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || rootEnv.NEXT_PUBLIC_SOCKET_URL || '',
  },
  async rewrites() {
    let backendUrl = process.env.BACKEND_INTERNAL_URL || rootEnv.BACKEND_INTERNAL_URL;
    if (!backendUrl) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || rootEnv.NEXT_PUBLIC_API_URL;
      if (apiUrl && (apiUrl.startsWith('http://') || apiUrl.startsWith('https://'))) {
        backendUrl = apiUrl.replace(/\/api\/?$/, '');
      } else {
        backendUrl = `http://localhost:${process.env.PORT || rootEnv.PORT || '5000'}`;
      }
    }
    return [
      { source: '/api/:path*', destination: `${backendUrl}/api/:path*` },
      { source: '/uploads/:path*', destination: `${backendUrl}/uploads/:path*` },
    ];
  },
};

module.exports = nextConfig;
