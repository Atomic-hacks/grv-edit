// Strips personal data out of a Sentry event before it leaves the building.
//
// Sentry's Node SDK attaches the HTTP request to whatever error it captures,
// and infers the client IP. For this app that means a failed
// /api/checkout/initialize would ship the customer's full name, phone,
// street address, city, state and postal code — plus their IP — to a third
// party, undisclosed and with no retention control on our side.
//
// Nothing here is needed to debug a stack trace: the route, status and
// stack are kept, the personal data is not.
const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-paystack-signature",
  "x-forwarded-for",
  "x-real-ip",
  "x-vercel-forwarded-for",
]);

const REDACTED = "[redacted]";

export const scrubSentryEvent = (event) => {
  if (!event || typeof event !== "object") return event;

  if (event.request && typeof event.request === "object") {
    // The request body: shipping address, phone, email, case text.
    if ("data" in event.request) event.request.data = REDACTED;
    if ("cookies" in event.request) event.request.cookies = REDACTED;
    // Query strings carry reset/verification/unsubscribe tokens.
    if ("query_string" in event.request) event.request.query_string = REDACTED;

    const headers = event.request.headers;
    if (headers && typeof headers === "object") {
      for (const name of Object.keys(headers)) {
        if (SENSITIVE_HEADERS.has(name.toLowerCase())) headers[name] = REDACTED;
      }
    }
  }

  if (event.user && typeof event.user === "object") {
    delete event.user.ip_address;
    delete event.user.email;
    delete event.user.username;
    // A bare user id is still useful for correlating reports and is not
    // itself identifying outside our own database.
  }

  return event;
};
