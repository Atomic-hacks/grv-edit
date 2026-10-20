import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, guard, audit } = vi.hoisted(() => ({
  prisma: {
    waitlistEntry: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    notification: { count: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
  guard: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("../../server/prisma.js", () => ({ prisma }));
vi.mock("../../server/requireAdmin.js", () => ({ requireAdmin: guard }));
vi.mock("../../server/auditLog.js", () => ({ recordAdminAction: audit }));

import {
  listAdminWaitlist,
  removeAdminWaitlistEntry,
} from "../handlers/adminWaitlist.js";

const request = new Request("https://shop.test/api/admin/waitlist");
const entry = {
  id: "w1",
  userId: "u1",
  variantId: "v1",
  status: "NOTIFIED",
  createdAt: "2026-10-19T10:00:00.000Z",
  user: { id: "u1", name: "Ada", email: "ada@example.com", active: true },
  variant: {
    color: "Black",
    size: "M",
    sku: "SKU-1",
    stock: 3,
    productId: "p1",
    product: { name: "Jacket", archived: false },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  guard.mockResolvedValue({ ok: true, user: { id: "admin-1" } });
  prisma.waitlistEntry.findMany.mockResolvedValue([entry]);
  prisma.waitlistEntry.count.mockResolvedValue(1);
  prisma.waitlistEntry.groupBy.mockResolvedValue([
    { status: "WAITING", _count: { _all: 2 } },
    { status: "NOTIFIED", _count: { _all: 1 } },
  ]);
  prisma.notification.count.mockResolvedValue(1);
  prisma.notification.findMany.mockResolvedValue([
    {
      id: "n1",
      userId: "u1",
      productId: "p1",
      message: "Jacket (Black, M) is back in stock!",
      sent: false,
      createdAt: "2026-10-19T11:00:00.000Z",
    },
  ]);
});

describe("admin waitlist", () => {
  it("rejects non-admins before reading subscriber details", async () => {
    guard.mockResolvedValue({ ok: false, status: 403, body: { error: "Forbidden" } });
    const response = await listAdminWaitlist(request, new URL(request.url));
    expect(response.status).toBe(403);
    expect(prisma.waitlistEntry.findMany).not.toHaveBeenCalled();
  });

  it("returns subscriber, inventory, aggregate, and delivery state", async () => {
    const response = await listAdminWaitlist(request, new URL(request.url));
    const body = await response.json();
    expect(body.counts).toEqual({ WAITING: 2, NOTIFIED: 1, FULFILLED: 0 });
    expect(body.queuedEmails).toBe(1);
    expect(body.entries[0]).toMatchObject({
      customer: { email: "ada@example.com" },
      variant: { productName: "Jacket", stock: 3, sku: "SKU-1" },
      delivery: { notificationId: "n1", state: "QUEUED" },
    });
  });

  it("removes the subscription, cancels its exact queued email, and audits atomically", async () => {
    prisma.waitlistEntry.findUnique.mockResolvedValue(entry);
    prisma.notification.deleteMany.mockResolvedValue({ count: 1 });
    prisma.waitlistEntry.delete.mockResolvedValue(entry);
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    audit.mockResolvedValue();

    const response = await removeAdminWaitlistEntry(request, "w1");
    expect(await response.json()).toEqual({ success: true, cancelledQueuedEmails: 1 });
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        userId: "u1",
        productId: "p1",
        message: { endsWith: " (Black, M) is back in stock!" },
        sent: false,
      }),
    });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "waitlist.entry_removed" }),
      { prisma, required: true },
    );
  });
});
