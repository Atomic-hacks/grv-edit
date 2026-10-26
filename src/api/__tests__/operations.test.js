import { beforeEach, expect, it, vi } from 'vitest';
const { prisma, guard } = vi.hoisted(() => ({ prisma: { pendingCheckout: { findMany: vi.fn(), count: vi.fn() }, notification: { count: vi.fn() } }, guard: vi.fn() }));
vi.mock('../../server/prisma.js', () => ({ prisma }));
vi.mock('../../server/requireAdmin.js', () => ({ requireAdmin: guard }));
import { getAdminOperations } from '../handlers/operations.js';
const request = new Request('https://shop.test/api/admin/operations');
beforeEach(() => { vi.clearAllMocks(); });
it('rejects non-admin access before touching payment data', async () => {
  guard.mockResolvedValue({ ok: false, status: 403, body: { error: 'Forbidden' } });
  expect((await getAdminOperations(request, new URL(request.url))).status).toBe(403);
  expect(prisma.pendingCheckout.findMany).not.toHaveBeenCalled();
});
it('shows recovery metadata without exposing the checkout address or private payload', async () => {
  guard.mockResolvedValue({ ok: true });
  prisma.pendingCheckout.findMany.mockResolvedValue([{ reference: 'ref', createdAt: '2026-10-19', payload: { total: 100, inventoryReserved: true, address: 'private', fullName: 'private', email: 'private' } }]);
  prisma.pendingCheckout.count.mockResolvedValue(1); prisma.notification.count.mockResolvedValue(2);
  const body = await (await getAdminOperations(request, new URL(request.url))).json();
  expect(body.attempts[0]).toEqual({ reference: 'ref', createdAt: '2026-10-19', total: 100, reserved: true, status: 'Awaiting provider confirmation' });
  expect(JSON.stringify(body)).not.toContain('private');
});
