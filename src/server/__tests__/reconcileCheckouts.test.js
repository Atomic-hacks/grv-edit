import { expect, it, vi } from "vitest";
import { reconcileCheckouts } from "../reconcileCheckouts.js";

it('recovers late success and preserves unresolved payments instead of deleting attempts', async () => {
  const prisma = { $queryRaw: vi.fn().mockResolvedValue([{ reference: 'paid' }, { reference: 'pending' }, { reference: 'offline' }]), $executeRaw: vi.fn().mockResolvedValue(1) };
  const finalize = vi.fn().mockResolvedValue({ order: { id: 'order' } });
  const verify = vi.fn(async (ref) => { if (ref === 'offline') throw new Error('offline'); return { reference: ref, status: ref === 'paid' ? 'success' : 'pending' }; });
  const result = await reconcileCheckouts({ prisma, finalize, verify });
  expect(result.recovered).toBe(1);
  expect(result.errors).toHaveLength(1);
  expect(finalize).toHaveBeenCalledTimes(1);
  expect(prisma.$executeRaw).toHaveBeenCalledTimes(3);
  expect(prisma.pendingCheckout).toBeUndefined();
});
