// Sends one first-party page view per route change to /api/track, feeding the
// admin Visitors dashboard. The browser id is random, lives in localStorage
// and is never tied to an IP or cookie. Honours "Do Not Track" and never
// reports admin screens or token-bearing auth links (the server also
// refuses those paths).
const KEY = "grv_visitor";

const visitorId = () => {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null; // private mode: skip tracking rather than invent a new id per page
  }
};

// Dev's StrictMode runs effects twice, and a quick back/forward can repeat a
// path; the same page within a few seconds is one view, not two.
let last = { path: "", at: 0 };

export const trackVisit = (path, accessToken) => {
  if (typeof window === "undefined" || navigator.doNotTrack === "1") return;
  if (path.startsWith("/admin")) return;
  const id = visitorId();
  if (!id) return;
  if (last.path === path && Date.now() - last.at < 5000) return;
  last = { path, at: Date.now() };
  fetch("/api/track", {
    method: "POST",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ visitorId: id, path, referrer: document.referrer }),
  }).catch(() => {});
};
