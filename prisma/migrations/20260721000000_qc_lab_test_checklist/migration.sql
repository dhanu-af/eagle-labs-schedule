-- CreateEnum
CREATE TYPE "QcProductCategory" AS ENUM ('CAPSULE', 'GUMMY');

-- CreateEnum
CREATE TYPE "QcTestResult" AS ENUM ('PASS', 'FAIL');

-- AlterTable
ALTER TABLE "QcSample" ADD COLUMN     "productCategory" "QcProductCategory";

-- AlterTable
ALTER TABLE "QcLabTest" DROP COLUMN "activeIngredients",
DROP COLUMN "appearance",
DROP COLUMN "coaReference",
DROP COLUMN "disintegration",
DROP COLUMN "hardness",
DROP COLUMN "heavyMetals",
DROP COLUMN "labelInspection",
DROP COLUMN "microbiology",
DROP COLUMN "moisture",
DROP COLUMN "packagingInspection",
DROP COLUMN "photographUrls",
DROP COLUMN "qcNotes",
DROP COLUMN "weightCheck";

-- CreateTable
CREATE TABLE "QcLabTestItem" (
    "id" TEXT NOT NULL,
    "labTestId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "result" "QcTestResult",
    "details" TEXT,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "QcLabTestItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QcLabTestItem_labTestId_idx" ON "QcLabTestItem"("labTestId");

-- AddForeignKey
ALTER TABLE "QcLabTestItem" ADD CONSTRAINT "QcLabTestItem_labTestId_fkey" FOREIGN KEY ("labTestId") REFERENCES "QcLabTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

