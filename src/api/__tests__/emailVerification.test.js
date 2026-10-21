import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, getCurrentUser, checkRateLimit, getUserById, updateUserById } =
  vi.hoisted(() => ({
    prisma: {},
    getCurrentUser: vi.fn(),
    checkRateLimit: vi.fn(),
    getUserById: vi.fn(),
    updateUserById: vi.fn(),
  }));

vi.mock("../../server/prisma.js", () => ({ prisma }));
vi.mock("../../server/getCurrentUser.js", () => ({ getCurrentUser }));
vi.mock("../../server/rateLimit.js", () => ({
  checkRateLimit,
  clientIp: () => "127.0.0.1",
}));
vi.mock("../../server/supabaseAdmin.js", () => ({
  getSupabaseAdmin: () => ({
    auth: { admin: { getUserById, updateUserById } },
  }),
}));
vi.mock("../../server/sendEmail.js", () => ({
  sendEmail: vi.fn().mockResolvedValue({ sent: true }),
}));
vi.mock("../../server/orderEmails.js", () => ({
  queueOrderEmail: vi.fn(),
  queueBrandNotifications: vi.fn(),
  EMAIL_TYPE_FOR_STATUS: {},
  retryFailedOrderEmails: vi.fn(),
}));
vi.mock("../../server/sentry.js", () => ({
  Sentry: { captureException: vi.fn() },
}));

import { handleApiRequest } from "../routes.js";

const userId = "9b2cff5f-06e8-4a42-bd47-d34bb31e5a91";
const request = (body) =>
  handleApiRequest(
    new Request("https://shop.test/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue(null);
  checkRateLimit.mockResolvedValue({ allowed: true });
  getUserById.mockResolvedValue({
    data: {
      user: {
        id: userId,
        email: "customer@example.com",
        user_metadata: { name: "Customer" },
      },
    },
    error: null,
  });
  updateUserById.mockResolvedValue({ data: { user: { id: userId } }, error: null });

  prisma.user = {
    findFirst: vi.fn().mockResolvedValue({ id: userId }),
    upsert: vi.fn().mockResolvedValue({
      id: userId,
      email: "customer@example.com",
      active: true,
    }),
    update: vi.fn().mockResolvedValue({ id: userId, emailVerified: true }),
  };
  prisma.emailVerificationCode = {
    findFirst: vi.fn().mockResolvedValue({
      id: "code-1",
      code: "123456",
      attempts: 0,
    }),
    update: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
  prisma.$transaction = vi.fn(async (callback) => callback(prisma));
});

describe("email confirmation without a pre-existing session", () => {
  it("confirms both the application user and the Supabase Auth user", async () => {
    const response = await request({ userId, code: "123456" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ verified: true });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { emailVerified: true },
    });
    expect(updateUserById).toHaveBeenCalledWith(userId, {
      email_confirm: true,
    });
  });

  it("supports confirmation pages created before userId was added", async () => {
    const response = await request({
      email: "CUSTOMER@example.com",
      code: "123456",
    });

    expect(response.status).toBe(200);
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        email: { equals: "customer@example.com", mode: "insensitive" },
      },
      select: { id: true },
    });
  });

  it("rate limits code guessing before reading an account", async () => {
    checkRateLimit.mockResolvedValue({ allowed: false });
    const response = await request({ userId, code: "123456" });

    expect(response.status).toBe(429);
    expect(getUserById).not.toHaveBeenCalled();
    expect(prisma.emailVerificationCode.findFirst).not.toHaveBeenCalled();
  });
});
