// Role-based guard for /api/admin/* routes that need finer-grained access
// than "is an admin" — refunds, complaints, fulfilment, analytics, staff
// management. Mirrors requireAdmin.js's shape (server-side only, checks the
// Prisma User row, never trusts client state) but accepts a specific set of
// roles instead of hard-coding ADMIN.
import { getCurrentUser } from "./getCurrentUser.js";

// OWNER is always allowed, regardless of which roles a route lists — it is
// the one role meant to have full access everywhere.
export const requireRole = async (request, allowedRoles) => {
  const user = await getCurrentUser(request);
  if (!user) return { ok: false, status: 401, body: { error: "Unauthorized" } };
  if (user.role !== "OWNER" && !allowedRoles.includes(user.role)) {
    return { ok: false, status: 403, body: { error: "Forbidden" } };
  }
  return { ok: true, user };
};
