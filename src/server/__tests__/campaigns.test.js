import { describe, it, expect, vi } from "vitest";
import { sendCampaign, resolveAudience } from "../campaigns.js";

const baseCampaign = {
  id: "camp_1",
  subject: "New season",
  preheader: null,
  body: "The new arrivals have landed.",
  imageUrl: null,
  ctaLabel: null,
  ctaUrl: null,
  featuredProductIds: [],
  audience: "CUSTOMERS",
  status: "SCHEDULED",
  sentAt: null,
};

// Fake Prisma whose `campaign.updateMany` honours the status guard — that
// conditional update is what stops a double-click sending twice.
const fakePrisma = ({ campaign = baseCampaign, users = [], subscribers = [] } = {}) => {
  const state = { campaign: { ...campaign }, users: [...users], subscribers: [...subscribers] };
  return {
    state,
    campaign: {
      updateMany: async ({ where, data }) => {
        const statusMatches = where.status?.in
          ? where.status.in.includes(state.campaign.status)
          : true;
        if (where.id !== state.campaign.id || !statusMatches) return { count: 0 };
        Object.assign(state.campaign, data);
        return { count: 1 };
      },
      findUnique: async () => ({ ...state.campaign }),
      update: async ({ data }) => {
        Object.assign(state.campaign, data);
        return { ...state.campaign };
      },
    },
    user: {
      findMany: async () => state.users,
      update: async ({ where, data }) => {
        const user = state.users.find((item) => item.id === where.id);
        Object.assign(user, data);
        return user;
      },
    },
    newsletterSubscriber: {
      findMany: async () => state.subscribers,
      update: async ({ where, data }) => {
        const sub = state.subscribers.find((item) => item.id === where.id);
        Object.assign(sub, data);
        return sub;
      },
    },
    product: { findMany: async () => [] },
  };
};

const optedInUser = (id, email) => ({ id, email, unsubscribeToken: null });

describe("resolveAudience", () => {
  it("only includes customers who opted in", async () => {
    // findMany is already filtered by marketingOptIn in the query; this
    // asserts the query is the one actually issued.
    const prisma = fakePrisma({ users: [optedInUser("u1", "a@example.com")] });
    const spy = vi.spyOn(prisma.user, "findMany");

    await resolveAudience("CUSTOMERS", { prisma });

    expect(spy.mock.calls[0][0].where).toMatchObject({ marketingOptIn: true });
  });

  it("excludes unsubscribed newsletter subscribers", async () => {
    const prisma = fakePrisma({ subscribers: [{ id: "s1", email: "b@example.com", unsubscribeToken: null }] });
    const spy = vi.spyOn(prisma.newsletterSubscriber, "findMany");

    await resolveAudience("NEWSLETTER", { prisma });

    expect(spy.mock.calls[0][0].where).toMatchObject({ unsubscribedAt: null });
  });

  it("de-duplicates a person who is both a customer and a subscriber", async () => {
    const prisma = fakePrisma({
      users: [optedInUser("u1", "same@example.com")],
      subscribers: [{ id: "s1", email: "SAME@example.com", unsubscribeToken: null }],
    });

    const recipients = await resolveAudience("ALL", { prisma });

    expect(recipients).toHaveLength(1);
  });
});

describe("sendCampaign", () => {
  it("sends one email per recipient and records the result", async () => {
    const prisma = fakePrisma({
      users: [optedInUser("u1", "a@example.com"), optedInUser("u2", "b@example.com")],
    });
    const sendEmail = vi.fn().mockResolvedValue({ sent: true });

    const result = await sendCampaign("camp_1", { prisma, sendEmail });

    expect(result.sent).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(prisma.state.campaign.status).toBe("SENT");
    expect(prisma.state.campaign.sentCount).toBe(2);
  });

  it("includes a working unsubscribe link for every recipient", async () => {
    const prisma = fakePrisma({ users: [optedInUser("u1", "a@example.com")] });
    const sendEmail = vi.fn().mockResolvedValue({ sent: true });

    await sendCampaign("camp_1", { prisma, sendEmail });

    const { html } = sendEmail.mock.calls[0][0];
    expect(html).toContain("/unsubscribe?token=");
    // The token must have actually been persisted, or the link 404s.
    expect(prisma.state.users[0].unsubscribeToken).toBeTruthy();
    expect(html).toContain(prisma.state.users[0].unsubscribeToken);
  });

  it("cannot be sent twice", async () => {
    // The admin double-clicks, or refreshes and clicks again.
    const prisma = fakePrisma({ users: [optedInUser("u1", "a@example.com")] });
    const sendEmail = vi.fn().mockResolvedValue({ sent: true });

    await sendCampaign("camp_1", { prisma, sendEmail });
    const second = await sendCampaign("camp_1", { prisma, sendEmail });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(second.sent).toBe(false);
    expect(second.reason).toBe("already-sent");
  });

  it("does not report a campaign as sent when every message failed", async () => {
    const prisma = fakePrisma({ users: [optedInUser("u1", "a@example.com")] });
    const sendEmail = vi.fn().mockResolvedValue({ sent: false, message: "provider down" });

    const result = await sendCampaign("camp_1", { prisma, sendEmail });

    expect(result.sent).toBe(false);
    expect(prisma.state.campaign.status).toBe("FAILED");
    expect(prisma.state.campaign.sentAt).toBeNull();
    expect(prisma.state.campaign.lastError).toBe("provider down");
  });

  it("records partial failure without losing the successful sends", async () => {
    const prisma = fakePrisma({
      users: [optedInUser("u1", "a@example.com"), optedInUser("u2", "b@example.com")],
    });
    const sendEmail = vi
      .fn()
      .mockResolvedValueOnce({ sent: true })
      .mockResolvedValueOnce({ sent: false, message: "bounced" });

    const result = await sendCampaign("camp_1", { prisma, sendEmail });

    expect(result.sent).toBe(true);
    expect(prisma.state.campaign.sentCount).toBe(1);
    expect(prisma.state.campaign.failedCount).toBe(1);
    expect(prisma.state.campaign.status).toBe("SENT");
  });

  it("refuses to send a cancelled campaign", async () => {
    const prisma = fakePrisma({ campaign: { ...baseCampaign, status: "CANCELLED" } });
    const sendEmail = vi.fn();

    const result = await sendCampaign("camp_1", { prisma, sendEmail });

    expect(result.sent).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
