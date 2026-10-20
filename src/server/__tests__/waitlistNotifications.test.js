import { describe, expect, it, vi } from "vitest";
import { processWaitlistRestocks } from "../waitlistNotifications.js";

const restock = { variantId: "v1", productId: "p1", productName: "Shirt", color: "Blue", size: "M" };
const setup = () => {
  let committed = false;
  const transaction = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "e1", userId: "u1" }, { id: "e2", userId: "u2" }]),
    waitlistEntry: {
      findMany: vi.fn().mockResolvedValue([{ id: "e1", userId: "u1" }, { id: "e2", userId: "u2" }]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    notification: { createManyAndReturn: vi.fn().mockImplementation(async ({ data }) => data.map((item) => ({ id: item.userId, ...item }))) },
  };
  const prisma = { $transaction: vi.fn(async (work) => { const result = await work(transaction); committed = true; return result; }) };
  const sendNotificationEmail = vi.fn(async (client) => {
    expect(committed).toBe(true);
    expect(client).toBe(prisma);
    return false;
  });
  return { transaction, prisma, sendNotificationEmail };
};

describe("restock delivery", () => {
  it("persists notifications before email delivery, outside the inventory transaction", async () => {
    const deps = setup();
    await processWaitlistRestocks([restock], deps);
    expect(deps.transaction.notification.createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(deps.sendNotificationEmail).toHaveBeenCalledTimes(2);
    expect(deps.transaction.notification.createManyAndReturn).toHaveBeenCalledWith(expect.objectContaining({ data: expect.arrayContaining([expect.objectContaining({ sent: false, type: "WAITLIST_RESTOCK" })]) }));
  });
  it("skips subscriptions claimed by a concurrent worker", async () => {
    const deps = setup();
    deps.transaction.$queryRaw.mockResolvedValue([]);
    await processWaitlistRestocks([restock], deps);
    expect(deps.transaction.notification.createManyAndReturn).not.toHaveBeenCalled();
    expect(deps.sendNotificationEmail).not.toHaveBeenCalled();
  });
  it("continues delivering after one provider failure", async () => {
    const deps = setup();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    deps.sendNotificationEmail.mockRejectedValueOnce(new Error("provider offline"));
    try {
      await processWaitlistRestocks([restock], deps);
      expect(deps.sendNotificationEmail).toHaveBeenCalledTimes(2);
      expect(log).toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
});
