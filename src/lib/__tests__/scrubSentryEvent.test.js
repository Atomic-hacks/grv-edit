import { describe, it, expect } from "vitest";
import { scrubSentryEvent } from "../scrubSentryEvent.js";

// Modelled on a real event this project sent to Sentry: the pasted
// production issue carried the full HTTP request body and `user: ip:...`.
const checkoutFailureEvent = () => ({
  level: "error",
  transaction: "POST /api/checkout/initialize",
  request: {
    url: "https://www.grvhq.com/api/checkout/initialize",
    method: "POST",
    query_string: "token=secret-reset-token",
    data: {
      fullName: "Ada Lovelace",
      phone: "+2348012345678",
      address: "12 Marina Road",
      city: "Lagos",
      state: "Lagos",
      postalCode: "100001",
    },
    cookies: "sb-access-token=eyJhbGci",
    headers: {
      Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9",
      Cookie: "sb-access-token=eyJhbGci",
      "X-Forwarded-For": "102.90.98.94",
      "x-paystack-signature": "abc123",
      "User-Agent": "Mozilla/5.0",
      "Content-Type": "application/json",
    },
  },
  user: {
    id: "user-123",
    ip_address: "102.90.98.94",
    email: "ada@example.com",
    username: "ada",
  },
});

const flatten = (value) => JSON.stringify(value);

describe("scrubSentryEvent", () => {
  it("removes the request body containing the shipping address", () => {
    const event = scrubSentryEvent(checkoutFailureEvent());
    expect(event.request.data).toBe("[redacted]");
    for (const pii of ["Ada Lovelace", "+2348012345678", "12 Marina Road", "100001"]) {
      expect(flatten(event), pii).not.toContain(pii);
    }
  });

  it("removes the client IP address", () => {
    const event = scrubSentryEvent(checkoutFailureEvent());
    expect(event.user.ip_address).toBeUndefined();
    expect(flatten(event)).not.toContain("102.90.98.94");
  });

  it("removes the customer email and username", () => {
    const event = scrubSentryEvent(checkoutFailureEvent());
    expect(event.user.email).toBeUndefined();
    expect(event.user.username).toBeUndefined();
    expect(flatten(event)).not.toContain("ada@example.com");
  });

  it("redacts auth, cookie and signature headers regardless of casing", () => {
    const { request } = scrubSentryEvent(checkoutFailureEvent());
    expect(request.headers.Authorization).toBe("[redacted]");
    expect(request.headers.Cookie).toBe("[redacted]");
    expect(request.headers["X-Forwarded-For"]).toBe("[redacted]");
    expect(request.headers["x-paystack-signature"]).toBe("[redacted]");
    expect(flatten(request.headers)).not.toContain("eyJhbGci");
  });

  it("redacts the query string, which carries reset tokens", () => {
    const event = scrubSentryEvent(checkoutFailureEvent());
    expect(event.request.query_string).toBe("[redacted]");
    expect(flatten(event)).not.toContain("secret-reset-token");
  });

  it("keeps what is actually needed to debug", () => {
    const event = scrubSentryEvent(checkoutFailureEvent());
    expect(event.transaction).toBe("POST /api/checkout/initialize");
    expect(event.request.url).toBe("https://www.grvhq.com/api/checkout/initialize");
    expect(event.request.method).toBe("POST");
    expect(event.request.headers["User-Agent"]).toBe("Mozilla/5.0");
    expect(event.user.id).toBe("user-123");
  });

  it("survives events with no request or user section", () => {
    expect(() => scrubSentryEvent({ level: "error" })).not.toThrow();
    expect(scrubSentryEvent(null)).toBeNull();
    expect(scrubSentryEvent(undefined)).toBeUndefined();
  });
});
