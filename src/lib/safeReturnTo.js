// Where to send someone after they log in / confirm email / sign in with
// Google. The value comes from the URL (?returnTo=...), so it's attacker
// controlled: a crafted link must never be able to land a user on another
// site. Only a plain in-site path is accepted; anything else becomes the
// fallback.
//
// Rejected on purpose: "//evil.com" and "/\evil.com" (browsers treat both as
// protocol-relative), "https://evil.com", "javascript:...", and "@evil.com"
// (which turns `https://grvhq.com` + value into `https://grvhq.com@evil.com`,
// a login to evil.com).
export const safeReturnTo = (value, fallback = "/account") => {
  if (typeof value !== "string") return fallback;
  const path = value.trim();
  if (!path.startsWith("/")) return fallback;
  if (path.startsWith("//") || path.startsWith("/\\")) return fallback;
  // Backslashes and control characters anywhere can be reinterpreted by
  // browsers' URL parsers.
  if (path.includes("\\")) return fallback;
  for (const character of path) {
    if (character.charCodeAt(0) < 32) return fallback;
  }
  return path;
};
