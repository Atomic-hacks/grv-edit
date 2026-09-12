// Guard for any route under /api/admin/*. Checks the caller's role via
// Prisma (the User row synced by the DB trigger), not client-supplied state.
import { getCurrentUser } from "./getCurrentUser.js";

export const requireAdmin = async (request) => {
  const user = await getCurrentUser(request);
  if (!user) return { ok: false, status: 401, body: { error: "Unauthorized" } };
  if (user.role !== "ADMIN")
    return { ok: false, status: 403, body: { error: "Forbidden" } };
  return { ok: true, user };
};
