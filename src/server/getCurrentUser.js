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

export const getCurrentUser = async (request) => {
  const token = getBearerToken(request);
  if (!token) return null;

  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error || !data?.user) return null;

  const user = await prisma.user.findUnique({ where: { id: data.user.id } });
  if (!user || !user.active) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    emailVerified: user.emailVerified,
    hasSeenFirstOrderBanner: user.hasSeenFirstOrderBanner,
    firstOrderPromoUsed: user.firstOrderPromoUsed,
  };
};
