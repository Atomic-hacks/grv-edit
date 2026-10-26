import { expect, it, vi } from "vitest";
vi.mock('../orderEmails.js', () => ({ retryFailedOrderEmails: vi.fn().mockResolvedValue({ retried: 0 }) }));
vi.mock('../campaigns.js', () => ({ processDueCampaigns: vi.fn().mockResolvedValue([]) }));
import { runReminderChecks } from '../runReminderChecks.js';
it('respects email preferences, retries failed wishlist sends, and never deletes payment attempts', async () => {
  const prisma = {
    rateLimitHit: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    cart: { findMany: vi.fn().mockResolvedValue([]) },
    wishlist: { findMany: vi.fn().mockResolvedValue([{ id: 'w1', user: { email: 'test@test.local' }, product: { id: 'p1', name: 'Shirt' } }]), update: vi.fn() },
  };
  const emailSender = vi.fn().mockResolvedValue({ sent: false, message: 'offline' });
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const result = await runReminderChecks({ prismaClient: prisma, emailSender });
    expect(result.wishlistsReminded).toBe(0);
    expect(prisma.wishlist.update).not.toHaveBeenCalled();
    for (const model of [prisma.cart, prisma.wishlist]) expect(model.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ user: { active: true, marketingOptIn: true } }) }));
    emailSender.mockResolvedValue({ sent: true });
    expect((await runReminderChecks({ prismaClient: prisma, emailSender })).wishlistsReminded).toBe(1);
    expect(prisma.wishlist.update).toHaveBeenCalledTimes(1);
  } finally { log.mockRestore(); }
});
