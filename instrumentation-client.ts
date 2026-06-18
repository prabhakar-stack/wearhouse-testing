// instrumentation-client.ts
// This file configures the Sentry SDK for the browser (client-side).
// It is loaded automatically by Next.js before the app renders.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 100% of transactions in development; lower in production if needed.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

  // Replay 10% of sessions normally; 100% when an error occurs.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      // Mask all text and inputs by default for privacy
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  // Print debug logs in development only
  debug: process.env.NODE_ENV === "development",
});

// Required by Sentry to instrument client-side route transitions/navigations.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
