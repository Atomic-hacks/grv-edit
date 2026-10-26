import { beforeEach, describe, expect, it, vi } from "vitest";
import { reconcileFirstOrderPromoReservation } from "../promotionReservations.js";

const userId = "user-1";
const reference = "checkout-1";
let prisma;
let verifyPayment;
let releaseCheckout;
let finalizeCheckout;

beforeEach(() => {
  prisma = {
    firstOrderPromoRedemption: {
      findUnique: vi.fn().mockResolvedValue({
        checkoutReference: reference,
        status: "RESERVED",
      }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    order: { findUnique: vi.fn().mockResolvedValue(null) },
    pendingCheckout: {
      findUnique: vi.fn().mockResolvedValue({
        reference,
        payload: { authorizationUrl: "https://checkout.paystack.com/resume" },
      }),
    },
  };
  verifyPayment = vi.fn();
  releaseCheckout = vi.fn().mockResolvedValue(true);
  finalizeCheckout = vi.fn();
});

const reconcile = () =>
  reconcileFirstOrderPromoReservation({
    prisma,
    userId,
    verifyPayment,
    releaseCheckout,
    finalizeCheckout,
  });

describe("first-order promotion reservation recovery", () => {
  it("releases the offer only after Paystack confirms terminal failure", async () => {
    verifyPayment.mockResolvedValue({ reference, status: "abandoned" });

    await expect(reconcile()).resolves.toEqual({ state: "AVAILABLE" });
    expect(releaseCheckout).toHaveBeenCalledWith(reference, "abandoned");
  });

  it("resumes the same checkout when payment verification is unavailable", async () => {
    verifyPayment.mockRejectedValue(new Error("timeout"));

    await expect(reconcile()).resolves.toEqual({
      state: "READY",
      reference,
      authorizationUrl: "https://checkout.paystack.com/resume",
    });
    expect(releaseCheckout).not.toHaveBeenCalled();
    expect(finalizeCheckout).not.toHaveBeenCalled();
  });

  it("keeps an unverifiable reservation blocked when it has no provider URL", async () => {
    prisma.pendingCheckout.findUnique.mockResolvedValue({
      reference,
      payload: {},
    });
    verifyPayment.mockRejectedValue(new Error("timeout"));

    await expect(reconcile()).resolves.toEqual({
      state: "UNKNOWN",
      reference,
    });
  });

  it("resumes an initialized checkout when no payment was attempted", async () => {
    verifyPayment.mockResolvedValue({
      reference,
      status: "ongoing",
      channel: null,
      paid_at: null,
      log: { attempts: 0, history: [] },
    });

    await expect(reconcile()).resolves.toEqual({
      state: "READY",
      reference,
      authorizationUrl: "https://checkout.paystack.com/resume",
    });
    expect(releaseCheckout).not.toHaveBeenCalled();
  });

  it("resumes the same reference when Paystack reports an ongoing payment", async () => {
    verifyPayment.mockResolvedValue({
      reference,
      status: "ongoing",
      channel: "bank_transfer",
      log: { attempts: 1 },
    });

    await expect(reconcile()).resolves.toEqual({
      state: "READY",
      reference,
      authorizationUrl: "https://checkout.paystack.com/resume",
    });
  });

  it("recovers a successful earlier payment instead of allowing another", async () => {
    const payment = { reference, status: "success" };
    verifyPayment.mockResolvedValue(payment);
    finalizeCheckout.mockResolvedValue({ order: { id: "order-1" } });

    await expect(reconcile()).resolves.toEqual({
      state: "PAID",
      reference,
      orderId: "order-1",
    });
    expect(finalizeCheckout).toHaveBeenCalledWith(reference, payment);
    expect(releaseCheckout).not.toHaveBeenCalled();
  });

  it("removes an orphan reservation with no order or payment payload", async () => {
    prisma.pendingCheckout.findUnique.mockResolvedValue(null);

    await expect(reconcile()).resolves.toEqual({ state: "AVAILABLE" });
    expect(prisma.firstOrderPromoRedemption.deleteMany).toHaveBeenCalledWith({
      where: { userId, checkoutReference: reference, status: "RESERVED" },
    });
    expect(verifyPayment).not.toHaveBeenCalled();
  });
});
