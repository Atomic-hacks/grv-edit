import React from "react";
import { Sentry } from "../lib/sentry.js";

// A class component because React's error-boundary API (getDerivedStateFromError
// / componentDidCatch) has no hook equivalent — this is the one place in the
// app that still needs one.
//
// Deliberately dependency-light: no react-router Link, no design-system
// component that itself might be implicated in the crash. Plain HTML, plain
// CSS variables, a hard reload. This is the last line of defence, not
// another layer of the app that can itself fail.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled render error", error, info?.componentStack);
    Sentry.captureException(error, {
      contexts: { react: { componentStack: info?.componentStack } },
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily:
            '"Helvetica Neue", Helvetica, Arial, sans-serif',
          background: "#fff",
          color: "#111111",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <p
            style={{
              fontSize: 16,
              fontWeight: 600,
              margin: "0 0 8px",
            }}
          >
            Something went wrong
          </p>
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.6,
              color: "#6b6b6b",
              margin: "0 0 20px",
            }}
          >
            This page hit an error it couldn't recover from. Reloading
            usually fixes it — if it keeps happening, get in touch and we'll
            look into it.
          </p>
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                border: "1px solid #111111",
                background: "#111111",
                color: "#fff",
                padding: "12px 24px",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Reload
            </button>
            <a
              href="/"
              style={{
                border: "1px solid #e5e5e5",
                color: "#111111",
                padding: "12px 24px",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                textDecoration: "none",
              }}
            >
              Go to homepage
            </a>
          </div>
        </div>
      </main>
    );
  }
}

export default ErrorBoundary;
