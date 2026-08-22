-- CreateEnum
CREATE TYPE "CalculationDirection" AS ENUM ('BOTTLES_TO_KG', 'KG_TO_OUTPUT');

-- CreateTable
CREATE TABLE "CapsuleCalculation" (
    "id" TEXT NOT NULL,
    "direction" "CalculationDirection" NOT NULL,
    "label" TEXT,
    "capsulesPerBottle" INTEGER NOT NULL,
    "avgFillWeightMg" DOUBLE PRECISION NOT NULL,
    "inputValue" DOUBLE PRECISION NOT NULL,
    "resultKg" DOUBLE PRECISION,
    "resultCapsules" DOUBLE PRECISION,
    "resultBottles" DOUBLE PRECISION,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapsuleCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CapsuleCalculation_createdAt_idx" ON "CapsuleCalculation"("createdAt");
