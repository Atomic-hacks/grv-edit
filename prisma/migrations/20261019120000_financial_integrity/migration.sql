-- Financial-integrity additions. Existing Float money columns are deliberately
-- retained until a verified backup and restore exist; all new refund amounts
-- are stored as integer kobo.
BEGIN;

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'RETURN_PENDING';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'RETURNED';
ALTER TYPE "FulfillmentStatus" ADD VALUE IF NOT EXISTS 'RETURN_PENDING';
ALTER TYPE "CaseStatus" ADD VALUE IF NOT EXISTS 'REFUND_UNKNOWN';

CREATE TYPE "RefundAttemptStatus" AS ENUM ('CREATED', 'PENDING', 'UNKNOWN', 'PROCESSED', 'FAILED');
CREATE TYPE "PromotionRedemptionStatus" AS ENUM ('RESERVED', 'REDEEMED');
CREATE TYPE "WaitlistDeliveryStatus" AS ENUM ('NOT_QUEUED', 'QUEUED', 'SENT', 'FAILED');

CREATE TABLE "RefundAttempt" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "transactionReference" TEXT NOT NULL,
  "providerRefundId" TEXT,
  "amountKobo" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "status" "RefundAttemptStatus" NOT NULL DEFAULT 'CREATED',
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RefundAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RefundAttempt_amountKobo_positive" CHECK ("amountKobo" > 0)
);

CREATE UNIQUE INDEX "RefundAttempt_providerRefundId_key" ON "RefundAttempt"("providerRefundId");
CREATE INDEX "RefundAttempt_orderId_status_idx" ON "RefundAttempt"("orderId", "status");
CREATE INDEX "RefundAttempt_caseId_status_idx" ON "RefundAttempt"("caseId", "status");
CREATE INDEX "RefundAttempt_transactionReference_idx" ON "RefundAttempt"("transactionReference");
ALTER TABLE "RefundAttempt" ADD CONSTRAINT "RefundAttempt_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SupportCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundAttempt" ADD CONSTRAINT "RefundAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "FirstOrderPromoRedemption" (
  "id" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "checkoutReference" TEXT NOT NULL,
  "status" "PromotionRedemptionStatus" NOT NULL DEFAULT 'RESERVED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FirstOrderPromoRedemption_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FirstOrderPromoRedemption_userId_key" ON "FirstOrderPromoRedemption"("userId");
CREATE UNIQUE INDEX "FirstOrderPromoRedemption_checkoutReference_key" ON "FirstOrderPromoRedemption"("checkoutReference");
CREATE INDEX "FirstOrderPromoRedemption_status_createdAt_idx" ON "FirstOrderPromoRedemption"("status", "createdAt");

CREATE TABLE "DiscountRedemption" (
  "id" TEXT NOT NULL,
  "discountId" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "checkoutReference" TEXT NOT NULL,
  "status" "PromotionRedemptionStatus" NOT NULL DEFAULT 'RESERVED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscountRedemption_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DiscountRedemption_checkoutReference_key" ON "DiscountRedemption"("checkoutReference");
CREATE INDEX "DiscountRedemption_discountId_status_idx" ON "DiscountRedemption"("discountId", "status");
CREATE INDEX "DiscountRedemption_userId_discountId_idx" ON "DiscountRedemption"("userId", "discountId");
ALTER TABLE "DiscountRedemption" ADD CONSTRAINT "DiscountRedemption_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WaitlistEntry"
  ADD COLUMN "deliveryStatus" "WaitlistDeliveryStatus" NOT NULL DEFAULT 'NOT_QUEUED',
  ADD COLUMN "deliveryAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastDeliveryError" TEXT,
  ADD COLUMN "providerMessageId" TEXT,
  ADD COLUMN "notifiedAt" TIMESTAMP(3),
  ADD COLUMN "fulfilledAt" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN "waitlistEntryId" TEXT;
CREATE UNIQUE INDEX "Notification_waitlistEntryId_key" ON "Notification"("waitlistEntryId");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_waitlistEntryId_fkey" FOREIGN KEY ("waitlistEntryId") REFERENCES "WaitlistEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- NOT VALID avoids making deployment fail because of historic malformed data,
-- while enforcing the rule for all new and updated rows immediately.
ALTER TABLE "Order" ADD CONSTRAINT "Order_trackingUrl_http_check"
  CHECK ("trackingUrl" IS NULL OR "trackingUrl" ~* '^https?://') NOT VALID;

COMMIT;
