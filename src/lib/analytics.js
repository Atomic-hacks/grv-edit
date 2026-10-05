// GA4 via gtag.js, loaded manually rather than through a library — this is
// the entire integration, so a dependency for it would be overkill. Every
// export here is a safe no-op when VITE_GA_MEASUREMENT_ID isn't set (local
// dev, or any deploy that hasn't been given one yet).
const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;

let initialized = false;

export const initAnalytics = () => {
  if (!measurementId || initialized || typeof document === "undefined") return;
  initialized = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  // send_page_view: false — the SPA sends its own page_view events per
  // route change (see trackPageview), so the first one isn't skipped and
  // later ones aren't silently missed on client-side navigation.
  window.gtag("config", measurementId, { send_page_view: false });
};

export const trackPageview = (path) => {
  if (!measurementId || typeof window.gtag !== "function") return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
};
