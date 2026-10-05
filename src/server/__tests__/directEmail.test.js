import { describe, expect, it, vi } from "vitest";
import { personalize, resolveDirectAudience, sendDirectEmails } from "../directEmail.js";

const user = (over) => ({ id: "u1", email: "a@x.com", name: "Ada Obi", unsubscribeToken: "tok", marketingOptIn: false, ...over });

const fakePrisma = (users, visitors = []) => ({
  user: {
    findMany: vi.fn(async () => users),
    findFirst: vi.fn(async ({ where }) => users.find((u) => (where.id ? u.id === where.id : true)) || null),
  },
  siteVisit: { groupBy: vi.fn(async () => visitors) },
});

describe("resolveDirectAudience", () => {
  it("a group without a service notice reaches only opted-in customers and counts the rest as skipped", async () => {
    const prisma = fakePrisma([user({ id: "1", marketingOptIn: true }), user({ id: "2" }), user({ id: "3" })]);
    const result = await resolveDirectAudience({ audience: "ALL" }, { prisma });
    expect(result.recipients).toHaveLength(1);
    expect(result.skipped).toBe(2);
  });

  it("a service notice reaches everyone in the group", async () => {
    const prisma = fakePrisma([user({ id: "1", marketingOptIn: true }), user({ id: "2" })]);
    const result = await resolveDirectAudience({ audience: "ALL", serviceNotice: true }, { prisma });
    expect(result.recipients).toHaveLength(2);
    expect(result.skipped).toBe(0);
  });

  it("only ever targets enabled customers, never staff", async () => {
    const prisma = fakePrisma([user()]);
    await resolveDirectAudience({ audience: "ALL", serviceNotice: true }, { prisma });
    expect(prisma.user.findMany.mock.calls[0][0].where).toMatchObject({ role: "CUSTOMER", active: true });
  });

  it("ACTIVE looks at recent visits and recent orders", async () => {
    const prisma = fakePrisma([user({ marketingOptIn: true })], [{ userId: "u9" }]);
    await resolveDirectAudience({ audience: "ACTIVE" }, { prisma });
    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.OR[0]).toEqual({ id: { in: ["u9"] } });
    expect(where.OR[1].orders.some.createdAt.gte).toBeInstanceOf(Date);
  });

  it("ORDERED requires a paid order", async () => {
    const prisma = fakePrisma([user({ marketingOptIn: true })]);
    await resolveDirectAudience({ audience: "ORDERED" }, { prisma });
    expect(prisma.user.findMany.mock.calls[0][0].where.orders.some.status.in).toEqual(["PAID", "SHIPPED", "DELIVERED"]);
  });

  it("one customer needs no marketing opt-in", async () => {
    const prisma = fakePrisma([user({ id: "u1", marketingOptIn: false })]);
    const result = await resolveDirectAudience({ audience: "ONE", userId: "u1" }, { prisma });
    expect(result.recipients.map((r) => r.email)).toEqual(["a@x.com"]);
  });

  it("validates a typed address and rejects nonsense", async () => {
    const prisma = fakePrisma([]);
    expect((await resolveDirectAudience({ audience: "EMAIL", email: " New@Person.com " }, { prisma })).recipients[0].email).toBe("new@person.com");
    expect((await resolveDirectAudience({ audience: "EMAIL", email: "not-an-email" }, { prisma })).error).toBeTruthy();
    expect((await resolveDirectAudience({ audience: "NOPE" }, { prisma })).error).toBeTruthy();
  });
});

describe("sending", () => {
  it("personalises with first names and falls back to 'there'", () => {
    expect(personalize("Hi {name},", "Ada Obi")).toBe("Hi Ada,");
    expect(personalize("Hi {name},", null)).toBe("Hi there,");
  });

  it("sends from the chosen address, counts failures, and adds an unsubscribe link only when asked", async () => {
    const sendEmail = vi.fn(async ({ to }) => (to === "bad@x.com" ? { sent: false, message: "rejected" } : { sent: true }));
    const prisma = { user: { update: vi.fn() } };
    const recipients = [
      { email: "a@x.com", name: "Ada", kind: "user", id: "1", token: "t1" },
      { email: "bad@x.com", name: null, kind: "user", id: "2", token: "t2" },
    ];
    const result = await sendDirectEmails(
      { recipients, sender: "SUPPORT", subject: "Hello {name}", body: "Body", withUnsubscribe: true },
      { prisma, sendEmail },
    );
    expect(result).toMatchObject({ sent: 1, failed: 1, firstError: "rejected" });
    const first = sendEmail.mock.calls.find(([m]) => m.to === "a@x.com")[0];
    expect(first.from).toMatch(/support@/);
    expect(first.subject).toBe("Hello Ada");
    expect(first.html).toContain("Unsubscribe");

    sendEmail.mockClear();
    await sendDirectEmails({ recipients: [recipients[0]], sender: "INFO", subject: "S", body: "B", withUnsubscribe: false }, { prisma, sendEmail });
    expect(sendEmail.mock.calls[0][0].html).not.toContain("Unsubscribe");
    expect(sendEmail.mock.calls[0][0].from).toMatch(/info@/);
  });
});
