-- AlterTable
ALTER TABLE "Product" ADD COLUMN "modelImages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
