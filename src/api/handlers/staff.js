// Owner-only staff role management. Deliberately does not build an invite/
// signup system — a person must already have a normal GRV account (they
// sign up like any customer), and an Owner promotes that existing account
// to a staff role by email.
import { prisma } from "../../server/prisma.js";
import { requireRole } from "../../server/requireRole.js";
import { recordAdminAction } from "../../server/auditLog.js";

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const STAFF_ASSIGNABLE_ROLES = [
  "OWNER",
  "ADMIN",
  "SUPPORT",
  "FULFILMENT",
  "ANALYST",
  "CUSTOMER",
];

const staffSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
};

export const listStaff = async (request) => {
  const guard = await requireRole(request, ["OWNER"]);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const staff = await prisma.user.findMany({
    where: { role: { not: "CUSTOMER" } },
    orderBy: { createdAt: "asc" },
    select: staffSelect,
  });
  return jsonResponse(staff);
};

export const setStaffRole = async (request, email) => {
  const guard = await requireRole(request, ["OWNER"]);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json().catch(() => ({}));
  const role = typeof body.role === "string" ? body.role : "";
  if (!STAFF_ASSIGNABLE_ROLES.includes(role)) {
    return jsonResponse({ error: "Invalid role" }, 400);
  }

  const target = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true },
  });
  if (!target) {
    return jsonResponse(
      {
        error:
          "No account found with that email. The person must sign up before being granted a role.",
      },
      404,
    );
  }
  if (target.id === guard.user.id && role !== "OWNER") {
    return jsonResponse(
      { error: "You cannot remove your own Owner access" },
      400,
    );
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { role },
    select: staffSelect,
  });

  await recordAdminAction({
    actorId: guard.user.id,
    action: "staff.role_changed",
    entityType: "User",
    entityId: target.id,
    previousState: { role: target.role },
    newState: { role },
  });

  return jsonResponse(updated);
};

export const handleAdminStaffRequest = async (request, segments) => {
  const email = segments[3] ? decodeURIComponent(segments[3]) : null;
  if (request.method === "GET" && !email) return listStaff(request);
  if (request.method === "PUT" && email) return setStaffRole(request, email);
  return jsonResponse({ error: "Method not allowed" }, 405);
};
