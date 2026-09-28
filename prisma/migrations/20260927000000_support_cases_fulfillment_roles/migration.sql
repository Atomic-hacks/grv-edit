-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('PLACED', 'PAYMENT_CONFIRMED', 'PROCESSING', 'READY_TO_SHIP', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'CANCELLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "CaseType" AS ENUM ('REFUND_REQUEST', 'WRONG_ITEM', 'MISSING_ITEM', 'DAMAGED_ITEM', 'ITEM_NOT_AS_DESCRIBED', 'PACKAGE_NOT_RECEIVED', 'DELIVERY_ISSUE', 'PAYMENT_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "CaseCategory" AS ENUM ('REFUND', 'COMPLAINT');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'AWAITING_CUSTOMER_INFO', 'APPROVED', 'REJECTED', 'REFUND_PROCESSING', 'REFUNDED', 'REFUND_FAILED', 'RESOLVED', 'CLOSED');

-- AlterEnum
-- New staff roles. Added one at a time in application logic is not required
-- since Postgres 12+ allows ADD VALUE inside a normal migration; this
-- project's target (Supabase/Postgres 15+) supports it.
ALTER TYPE "Role" ADD VALUE 'OWNER';
ALTER TYPE "Role" ADD VALUE 'SUPPORT';
ALTER TYPE "Role" ADD VALUE 'FULFILMENT';
ALTER TYPE "Role" ADD VALUE 'ANALYST';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "courierName" TEXT,
ADD COLUMN     "deliveryNotes" TEXT,
ADD COLUMN     "estimatedDeliveryDate" TIMESTAMP(3),
ADD COLUMN     "fulfillmentStatus" "FulfillmentStatus" NOT NULL DEFAULT 'PLACED',
ADD COLUMN     "shippingDate" TIMESTAMP(3),
ADD COLUMN     "trackingNumber" TEXT,
ADD COLUMN     "trackingUrl" TEXT;

-- CreateTable
CREATE TABLE "OrderFulfillmentEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "FulfillmentStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderFulfillmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportCase" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "orderId" TEXT,
    "orderItemIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "paystackReference" TEXT,
    "issueType" "CaseType" NOT NULL,
    "category" "CaseCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "requestedRefundAmount" DOUBLE PRECISION,
    "evidenceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "CaseStatus" NOT NULL DEFAULT 'SUBMITTED',
    "dedupeKey" TEXT NOT NULL,
    "refundReference" TEXT,
    "refundedAmount" DOUBLE PRECISION,
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseNote" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorId" UUID NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseEvent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "fromStatus" "CaseStatus",
    "toStatus" "CaseStatus" NOT NULL,
    "actorId" UUID,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "previousState" JSONB,
    "newState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderFulfillmentEvent_orderId_createdAt_idx" ON "OrderFulfillmentEvent"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportCase_reference_key" ON "SupportCase"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "SupportCase_dedupeKey_key" ON "SupportCase"("dedupeKey");

-- CreateIndex
CREATE INDEX "SupportCase_userId_idx" ON "SupportCase"("userId");

-- CreateIndex
CREATE INDEX "SupportCase_orderId_idx" ON "SupportCase"("orderId");

-- CreateIndex
CREATE INDEX "SupportCase_status_idx" ON "SupportCase"("status");

-- CreateIndex
CREATE INDEX "SupportCase_category_idx" ON "SupportCase"("category");

-- CreateIndex
CREATE INDEX "CaseNote_caseId_createdAt_idx" ON "CaseNote"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "CaseEvent_caseId_createdAt_idx" ON "CaseEvent"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_entityType_entityId_idx" ON "AdminAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "OrderFulfillmentEvent" ADD CONSTRAINT "OrderFulfillmentEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseNote" ADD CONSTRAINT "CaseNote_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SupportCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseNote" ADD CONSTRAINT "CaseNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseEvent" ADD CONSTRAINT "CaseEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SupportCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseEvent" ADD CONSTRAINT "CaseEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
