import { prisma as defaultPrisma } from "./prisma.js";

// Records one row per sensitive admin action (refund decisions, complaint
// status changes, order/fulfilment status changes, role changes). Critical
// transactional handlers use required:true so the action and its history
// either both commit or both roll back. Other legacy callers remain best effort.
export const recordAdminAction = async (
  { actorId, action, entityType, entityId, previousState, newState },
  { prisma = defaultPrisma, required = false } = {},
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
    if (required) throw error;
    console.error("Admin audit log write failed", {
      action,
      entityType,
      entityId,
      error,
    });
  }
};
