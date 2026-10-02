-- Generic, admin-managed storefront sections and safe brand order routing.
-- This migration intentionally adds to the existing taxonomy; it does not
-- replace the legacy SiteImage table, which is still used as a fallback.

ALTER TYPE "OrderEmailType" ADD VALUE IF NOT EXISTS 'BRAND_ORDER';

ALTER TABLE "OrderEmailEvent"
  ADD COLUMN IF NOT EXISTS "brandId" TEXT NOT NULL DEFAULT '';
DROP INDEX IF EXISTS "OrderEmailEvent_orderId_type_key";
CREATE UNIQUE INDEX IF NOT EXISTS "OrderEmailEvent_orderId_type_brandId_key"
  ON "OrderEmailEvent"("orderId", "type", "brandId");

ALTER TABLE "Brand"
  ADD COLUMN IF NOT EXISTS "contactEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "orderNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "FilterType"
  ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

CREATE TYPE "ContentPage" AS ENUM ('HOME', 'SHOP', 'DEPARTMENTS', 'CATEGORY');
CREATE TYPE "ContentLayout" AS ENUM ('HERO', 'BANNER', 'TILES', 'BENTO', 'PRODUCTS', 'BRANDS');
CREATE TYPE "ContentMediaType" AS ENUM ('IMAGE', 'VIDEO');
CREATE TYPE "ContentProductSource" AS ENUM ('NEW_ARRIVALS', 'FEATURED', 'CATEGORY', 'BRAND');

CREATE TABLE "ContentSection" (
  "id" TEXT NOT NULL,
  "page" "ContentPage" NOT NULL,
  "categoryId" TEXT,
  "layout" "ContentLayout" NOT NULL,
  "eyebrow" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "ctaLabel" TEXT,
  "ctaUrl" TEXT,
  "mediaType" "ContentMediaType" NOT NULL DEFAULT 'IMAGE',
  "imageUrl" TEXT,
  "videoUrl" TEXT,
  "items" JSONB,
  "productSource" "ContentProductSource",
  "sourceCategoryId" TEXT,
  "sourceBrandId" TEXT,
  "productLimit" INTEGER NOT NULL DEFAULT 12,
  "position" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentSection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContentSection_page_categoryId_active_position_idx"
  ON "ContentSection"("page", "categoryId", "active", "position");

ALTER TABLE "ContentSection"
  ADD CONSTRAINT "ContentSection_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ContentSection_sourceCategoryId_fkey"
    FOREIGN KEY ("sourceCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ContentSection_sourceBrandId_fkey"
    FOREIGN KEY ("sourceBrandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
