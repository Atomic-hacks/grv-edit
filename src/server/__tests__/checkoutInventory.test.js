import { describe, expect, it, vi } from "vitest";
import { aggregateCheckoutItems, allocateCheckoutStock, releaseCheckoutStock } from "../checkoutInventory.js";
import { hasPaystackPaymentAttempt, paymentMatchesCheckout } from "../paystack.js";

const item = (variantId, quantity = 1) => ({ productId: 'p1', variantId, quantity });
describe('checkout safety', () => {
  it('aggregates duplicate variants before stock checks and rejects malformed quantities', () => {
    expect(aggregateCheckoutItems([item('v1', 2), item('v1', 3)])).toEqual([item('v1', 5)]);
    for (const quantity of [0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1]) expect(() => aggregateCheckoutItems([item('v1', quantity)])).toThrow();
    expect(() => aggregateCheckoutItems([item('v1'), { ...item('v1'), productId: 'different' }])).toThrow();
  });
  it('lets only one competing purchase allocate the last unit', async () => {
    let stock = 1;
    const transaction = { variant: { updateMany: vi.fn(async ({ where, data }) => {
      if (stock < where.stock.gte) return { count: 0 };
      stock -= data.stock.decrement;
      return { count: 1 };
    }) } };
    const results = await Promise.allSettled([allocateCheckoutStock(transaction, [item('v1')]), allocateCheckoutStock(transaction, [item('v1')])]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(stock).toBe(0);
    expect(transaction.variant.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ product: { archived: false } }) }));
  });
  it('retains the payment payload and releases a reservation exactly once', async () => {
    let payload = { items: [item('v1', 2)], inventoryReserved: true, total: 200 };
    let stock = 0;
    const transaction = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      pendingCheckout: {
        findUnique: vi.fn(async () => ({ payload })),
        update: vi.fn(async ({ data }) => { payload = data.payload; }),
      },
      variant: { updateMany: vi.fn(async ({ data }) => { stock += data.stock.increment; return { count: 1 }; }), findUnique: vi.fn().mockResolvedValue({ id: "v1", stock: 2, productId: "p1", product: { name: "Shirt" } }) },
      firstOrderPromoRedemption: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      discountRedemption: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = { $transaction: (fn) => fn(transaction) };
    expect(await releaseCheckoutStock(prisma, 'ref', 'failed')).toBe(true);
    expect(await releaseCheckoutStock(prisma, 'ref', 'failed')).toBe(false);
    expect(stock).toBe(2);
    expect(payload.total).toBe(200);
    expect(payload.paymentStatus).toBe('failed');
    expect(transaction.firstOrderPromoRedemption.deleteMany).toHaveBeenCalledWith({
      where: { checkoutReference: 'ref', status: 'RESERVED' },
    });
  });
  it('requires exact reference, amount, currency and payment status', () => {
    const payment = { reference: 'ref', amount: 10001, currency: 'NGN', status: 'success' };
    expect(paymentMatchesCheckout(payment, 'ref', { total: 100.01 })).toBe(true);
    for (const change of [{ reference: 'other' }, { amount: 1 }, { amount: '10001' }, { currency: 'USD' }, { status: 'pending' }]) expect(paymentMatchesCheckout({ ...payment, ...change }, 'ref', { total: 100.01 })).toBe(false);
  });
  it('distinguishes an initialized checkout from an attempted payment', () => {
    expect(hasPaystackPaymentAttempt({ status: 'ongoing', channel: null, log: { attempts: 0, history: [] } })).toBe(false);
    expect(hasPaystackPaymentAttempt({ status: 'ongoing', channel: 'bank_transfer', log: { attempts: 1 } })).toBe(true);
    expect(hasPaystackPaymentAttempt({ status: 'pending', log: { history: [{ type: 'action' }] } })).toBe(true);
  });
});
