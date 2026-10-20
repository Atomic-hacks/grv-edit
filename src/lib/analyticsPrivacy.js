const PRIVATE_PATH = /^\/(admin|account|checkout|unsubscribe|login|signup|confirm-email|email-confirmed|forgot-password|reset-password|welcome)(\/|$)/i;
export const analyticsPage = (path, origin) => {
  const url = new URL(path, origin);
  if (url.origin !== origin || PRIVATE_PATH.test(url.pathname)) return null;
  // Only public pathname is sent. Query strings and fragments may carry tokens,
  // email addresses and payment references even on otherwise public pages.
  return { page_path: url.pathname, page_location: `${origin}${url.pathname}` };
};
