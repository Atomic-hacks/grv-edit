import { beforeEach, expect, it, vi } from 'vitest';
const { prisma, guard } = vi.hoisted(() => ({ prisma: {}, guard: vi.fn() }));
vi.mock('../../server/prisma.js', () => ({ prisma }));
vi.mock('../../server/requireRole.js', () => ({ requireRole: guard }));
import { setStaffRole } from '../handlers/staff.js';
let role;
const request = () => new Request('https://shop.test/api/admin/staff/test', { method: 'PUT', body: JSON.stringify({ role: 'ADMIN' }) });
beforeEach(() => {
  role = 'CUSTOMER';
  guard.mockResolvedValue({ ok: true, user: { id: 'owner' } });
  prisma.user = { findUnique: vi.fn(async () => ({ id: 'staff', role })), update: vi.fn(async ({ data }) => { role = data.role; return { id: 'staff', role }; }) };
  prisma.adminAuditLog = { create: vi.fn().mockResolvedValue({ id: 'audit' }) };
  prisma.$transaction = async (work) => { const before = role; try { return await work(prisma); } catch (error) { role = before; throw error; } };
});
it('rolls back a role change when its required audit record cannot be persisted', async () => {
  prisma.adminAuditLog.create.mockRejectedValue(new Error('audit offline'));
  await expect(setStaffRole(request(), 'staff@test.local')).rejects.toThrow('audit offline');
  expect(role).toBe('CUSTOMER');
});
it('commits a role change together with its actor and before/after record', async () => {
  expect((await setStaffRole(request(), 'staff@test.local')).status).toBe(200);
  expect(role).toBe('ADMIN');
  expect(prisma.adminAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actorId: 'owner', previousState: { role: 'CUSTOMER' }, newState: { role: 'ADMIN' } }) }));
});
