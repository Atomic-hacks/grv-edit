-- CreateTable
CREATE TABLE "PendingCheckout" (
    "reference" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingCheckout_pkey" PRIMARY KEY ("reference")
);

-- CreateIndex
CREATE INDEX "PendingCheckout_userId_idx" ON "PendingCheckout"("userId");
