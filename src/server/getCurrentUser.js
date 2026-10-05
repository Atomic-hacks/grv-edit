// Reusable server-side session lookup for src/api/* route handlers.
// Verifies the bearer access token against Supabase Auth, then loads the
// matching Prisma User row (source of truth for role). Returns null if the
// request isn't authenticated or the user row hasn't synced yet.
import { getSupabaseAdmin } from "./supabaseAdmin.js";
import { prisma } from "./prisma.js";

const getBearerToken = (request) => {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" ? token : null;
};

// A page load fires several authenticated requests at once (cart, wishlist,
// account, notifications…), and each one used to cost a Supabase round trip
// to verify the token. Remembering "this token belongs to user X" for a few
// seconds collapses that burst to one check. Only the token verification is
// remembered: the user's row (role, disabled flag, verified email, consent)
// is always read fresh, so staff changes and settings take effect at once.
// A signed-out or revoked session can linger for up to CACHE_MS. Failures are
// never remembered.
const CACHE_MS = 15_000;
const verified = new Map();

export const clearCurrentUserCache = () => verified.clear();

const verifyToken = (token) => {
  const hit = verified.get(token);
  if (hit && hit.expiresAt > Date.now()) return hit.pending;

  const pending = getSupabaseAdmin()
    .auth.getUser(token)
    .then(({ data, error }) => (error || !data?.user ? null : data.user.id));
  verified.set(token, { pending, expiresAt: Date.now() + CACHE_MS });
  if (verified.size > 500) {
    for (const [key, entry] of verified) if (entry.expiresAt <= Date.now()) verified.delete(key);
  }
  pending.then((id) => id || verified.delete(token), () => verified.delete(token));
  return pending;
};

export const getCurrentUser = async (request) => {
  const token = getBearerToken(request);
  if (!token) return null;

  const userId = await verifyToken(token);
  if (!userId) return null;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    emailVerified: user.emailVerified,
    hasSeenFirstOrderBanner: user.hasSeenFirstOrderBanner,
    firstOrderPromoUsed: user.firstOrderPromoUsed,
    // Surfaced on the account settings page ("Member since"). No new
    // column — createdAt already exists on every User row.
    createdAt: user.createdAt,
    marketingOptIn: user.marketingOptIn,
  };
};
