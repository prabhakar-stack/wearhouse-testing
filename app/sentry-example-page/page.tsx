"use client";
import * as Sentry from "@sentry/nextjs";

export default function SentryTestPage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "Inter, system-ui, sans-serif",
        background: "#0f172a",
        color: "#f1f5f9",
        gap: "24px",
      }}
    >
      <h1 style={{ fontSize: "1.8rem", fontWeight: 700 }}>🔍 Sentry Test Page</h1>
      <p style={{ color: "#94a3b8" }}>Click a button to send a test event to Sentry.</p>

      {/* Test 1: Unhandled JS error */}
      <button
        id="test-error-btn"
        onClick={() => {
          throw new Error("Test: Unhandled JS error from Sentry test page");
        }}
        style={btnStyle("#ef4444")}
      >
        Throw Unhandled Error
      </button>

      {/* Test 2: Manually captured exception */}
      <button
        id="test-capture-btn"
        onClick={() => {
          try {
            throw new Error("Test: Manually captured exception");
          } catch (err) {
            Sentry.captureException(err);
            alert("Exception captured and sent to Sentry ✅");
          }
        }}
        style={btnStyle("#f59e0b")}
      >
        Capture Exception Manually
      </button>

      {/* Test 3: Send a message */}
      <button
        id="test-message-btn"
        onClick={() => {
          Sentry.captureMessage("Test: Hello from Sentry test page!", "info");
          alert("Message sent to Sentry ✅");
        }}
        style={btnStyle("#3b82f6")}
      >
        Send Info Message
      </button>

      <p style={{ fontSize: "12px", color: "#475569", marginTop: "16px" }}>
        After clicking, check{" "}
        <a
          href="https://na-dba.sentry.io/projects/javascript-nextjs/issues/"
          target="_blank"
          rel="noreferrer"
          style={{ color: "#60a5fa" }}
        >
          sentry.io → Issues
        </a>
      </p>

      <p style={{ fontSize: "11px", color: "#334155" }}>
        Delete this page before production: <code>app/sentry-example-page/page.tsx</code>
      </p>
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: "12px 28px",
    background: bg,
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "14px",
    minWidth: "260px",
  };
}
