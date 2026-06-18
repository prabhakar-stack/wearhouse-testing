// instrumentation.ts
// Next.js 15 standard lifecycle hook.
// This loads the correct Sentry config depending on the runtime environment.
// Do NOT import Sentry directly here — use dynamic imports only.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry/server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry/edge.config");
  }
}

// Required by Sentry to capture errors from nested React Server Components.
// See: https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/#errors-from-nested-react-server-components
export { captureRequestError as onRequestError } from "@sentry/nextjs";
