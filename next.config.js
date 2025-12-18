const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Server-side external packages to avoid bundling issues
  serverExternalPackages: ['pino', 'thread-stream'],
  // Configure Turbopack
  turbopack: {
    resolveAlias: {
      '@': path.join(__dirname, 'src'),
    },
  },
}

module.exports = nextConfig
