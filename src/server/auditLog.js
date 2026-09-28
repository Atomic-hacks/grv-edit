import { prisma as defaultPrisma } from "./prisma.js";

// Records one row per sensitive admin action (refund decisions, complaint
// status changes, order/fulfilment status changes, role changes). Never
// throws — an audit log write failing must not roll back or block the
// action it is describing.
export const recordAdminAction = async (
  { actorId, action, entityType, entityId, previousState, newState },
  { prisma = defaultPrisma } = {},
) => {
  try {
    await prisma.adminAuditLog.create({
      data: {
        actorId,
        action,
        entityType,
        entityId,
        previousState: previousState ?? undefined,
        newState: newState ?? undefined,
      },
    });
  } catch (error) {
    console.error("Admin audit log write failed", {
      action,
      entityType,
      entityId,
      error,
    });
  }
};
