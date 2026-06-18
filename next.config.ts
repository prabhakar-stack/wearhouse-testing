import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  transpilePackages: ['motion'],
  experimental: {
    // Adding a comment here to force the Next.js dev server to restart.
    // This ensures it detects the newly created /api/upload API routes.
  },
  webpack: (config, { dev }) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry organization and project slugs (from your Sentry dashboard URL)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token for uploading source maps during Vercel build.
  // Set SENTRY_AUTH_TOKEN in Vercel env vars.
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only print Sentry build output in CI; suppress locally.
  silent: !process.env.CI,

  // Tunnels Sentry requests through /monitoring to avoid ad blockers.
  tunnelRoute: "/monitoring",

  // Upload source maps to Sentry but exclude them from the browser bundle.
  sourcemaps: {
    disable: false,
  },

  webpack: {
    // Automatically wrap all server functions (API routes, Server Actions) with Sentry.
    autoInstrumentServerFunctions: true,
    // Remove Sentry debug/logger statements from production bundles.
    treeshake: {
      removeDebugLogging: true,
    },
  },
});

