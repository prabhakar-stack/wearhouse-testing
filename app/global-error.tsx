"use client";
import * as Sentry from "@sentry/nextjs";
import React, { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report the error to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "Inter, system-ui, sans-serif",
          background: "#0f172a",
          color: "#f1f5f9",
          margin: 0,
          gap: "16px",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "#f87171" }}>
          Something went wrong
        </h1>
        <p style={{ color: "#94a3b8", maxWidth: "400px" }}>
          An unexpected error occurred. It has been reported automatically.
          {error?.digest && (
            <span style={{ display: "block", marginTop: "8px", fontSize: "12px", color: "#64748b" }}>
              Error ID: {error.digest}
            </span>
          )}
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: "8px",
            padding: "10px 24px",
            background: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "14px",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}

