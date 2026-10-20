import { prisma } from '../../server/prisma.js';
import { requireAdmin } from '../../server/requireAdmin.js';

export const getAdminOperations = async (request, url) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return Response.json(guard.body, { status: guard.status });
  const page = Math.max(1, Math.min(100000, Number.parseInt(url.searchParams.get('page'), 10) || 1));
  const [attempts, pendingCount, unsentNotifications, reservedCount] = await Promise.all([
    prisma.pendingCheckout.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * 50, take: 50 }),
    prisma.pendingCheckout.count(),
    prisma.notification.count({ where: { sent: false } }),
    prisma.pendingCheckout.count({ where: { payload: { path: ['inventoryReserved'], equals: true } } }),
  ]);
  return Response.json({
    page, pendingCount, unsentNotifications, reservedCount,
    attempts: attempts.map(({ reference, createdAt, payload }) => ({
      reference, createdAt, total: payload.total,
      reserved: payload.inventoryReserved === true,
      status: payload.paymentStatus || 'Awaiting provider confirmation',
    })),
  });
};
