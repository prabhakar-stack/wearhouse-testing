// sentry.server.config.ts
// This file configures the Sentry SDK on the server side.
// It covers API routes, cron handlers, Server Components, and Server Actions.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
});
