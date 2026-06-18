// sentry.edge.config.ts
// This file configures Sentry for the Edge runtime.
// It covers the Next.js middleware (middleware.ts) and any edge API routes.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

  debug: process.env.NODE_ENV === "development",
});
