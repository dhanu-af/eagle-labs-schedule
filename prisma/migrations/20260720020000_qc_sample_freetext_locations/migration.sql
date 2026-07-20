-- AlterTable: add new free-text location columns first
ALTER TABLE "QcSample" ADD COLUMN     "productionRoom" TEXT,
ADD COLUMN     "sampleStorageLocation" TEXT;

-- Backfill existing rows from their linked Bay/Location before those columns are dropped
UPDATE "QcSample" s
SET "productionRoom" = 'Bay ' || b."bayNumber"
FROM "DryingBay" b
WHERE s."bayId" = b."id";

UPDATE "QcSample" s
SET "sampleStorageLocation" = l."code" || ' — ' || l."label"
FROM "WarehouseLocation" l
WHERE s."warehouseLocationId" = l."id";

-- DropForeignKey
ALTER TABLE "QcSample" DROP CONSTRAINT "QcSample_bayId_fkey";

-- DropForeignKey
ALTER TABLE "QcSample" DROP CONSTRAINT "QcSample_warehouseLocationId_fkey";

-- DropIndex
DROP INDEX "QcSample_bayId_idx";

-- DropIndex
DROP INDEX "QcSample_warehouseLocationId_idx";

-- AlterTable
ALTER TABLE "QcSample" DROP COLUMN "bayId",
DROP COLUMN "warehouseLocationId";
