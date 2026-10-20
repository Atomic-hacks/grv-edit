import { beforeEach, expect, it, vi } from "vitest";

const { prisma, guard, queue, audit } = vi.hoisted(() => ({
  prisma: {
    variant: { findMany: vi.fn(), update: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
  guard: vi.fn(),
  queue: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("../../server/prisma.js", () => ({ prisma }));
vi.mock("../../server/requireRole.js", () => ({ requireRole: guard }));
vi.mock("../../server/auditLog.js", () => ({ recordAdminAction: audit }));
vi.mock("../../server/waitlistNotifications.js", () => ({ queueWaitlistRestock: queue }));

import { bulkAdjustProductStock } from "../handlers/productBulk.js";

beforeEach(() => {
  vi.clearAllMocks();
  guard.mockResolvedValue({ ok: true, user: { id: "admin-1" } });
  prisma.$transaction.mockImplementation((callback) => callback(prisma));
  prisma.variant.update.mockResolvedValue({});
  audit.mockResolvedValue();
  queue.mockResolvedValue([]);
});

it("queues and delivers waitlist updates when bulk stock crosses from zero", async () => {
  prisma.variant.findMany.mockResolvedValue([
    { id: "v1", stock: 0, color: "Black", size: "M", productId: "p1", product: { name: "Jacket" } },
    { id: "v2", stock: 2, color: "Black", size: "L", productId: "p1", product: { name: "Jacket" } },
  ]);
  const processRestocks = vi.fn().mockResolvedValue();
  const response = await bulkAdjustProductStock(
    new Request("https://shop.test/api/admin/products/bulk/stock", {
      method: "PUT",
      body: JSON.stringify({ ids: ["p1"], delta: 3 }),
    }),
    { processRestocks },
  );
  expect(await response.json()).toEqual({ variantsUpdated: 2, restockedVariants: 1 });
  expect(queue).toHaveBeenCalledTimes(1);
  expect(queue).toHaveBeenCalledWith(prisma, expect.objectContaining({ variantId: "v1", productName: "Jacket" }));
  expect(processRestocks).toHaveBeenCalledWith([expect.objectContaining({ variantId: "v1" })]);
});
