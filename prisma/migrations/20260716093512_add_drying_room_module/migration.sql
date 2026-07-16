-- CreateEnum
CREATE TYPE "DryingBayPurpose" AS ENUM ('EMPTY', 'DRYING', 'WAITING_QC', 'READY_FOR_POUCHING', 'CLEANING_REQUIRED', 'RND', 'STORAGE', 'SERVICE');

-- CreateEnum
CREATE TYPE "DryingStage" AS ENUM ('RECEIVING', 'DRYING', 'ROTATION_REQUIRED', 'CONTINUE_DRYING', 'QC_SAMPLING', 'QC_PENDING', 'QC_APPROVED', 'QC_HOLD', 'WRAPPING', 'READY_FOR_POUCHING', 'POUCHING', 'COMPLETE');

-- CreateEnum
CREATE TYPE "TrolleyQcStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED');

-- CreateTable
CREATE TABLE "DryingBay" (
    "id" TEXT NOT NULL,
    "bayNumber" INTEGER NOT NULL,
    "purpose" "DryingBayPurpose" NOT NULL DEFAULT 'EMPTY',
    "assignedEmployeeId" TEXT,
    "expectedFinishTime" TIMESTAMP(3),
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DryingBay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DryingBatch" (
    "id" TEXT NOT NULL,
    "bayId" TEXT,
    "productName" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "batchSize" DOUBLE PRECISION NOT NULL,
    "batchSizeUnit" TEXT NOT NULL,
    "numberOfTrolleys" INTEGER NOT NULL,
    "trayCount" INTEGER NOT NULL,
    "dateEnteredDryingRoom" TIMESTAMP(3) NOT NULL,
    "dryingStartTime" TIMESTAMP(3),
    "currentStage" "DryingStage" NOT NULL DEFAULT 'RECEIVING',
    "stageUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedEmployeeId" TEXT,
    "completedAt" TIMESTAMP(3),
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DryingBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DryingTrolley" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "trolleyNumber" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION,
    "trayCount" INTEGER,
    "wrapped" BOOLEAN NOT NULL DEFAULT false,
    "rotationCompleted" BOOLEAN NOT NULL DEFAULT false,
    "qcStatus" "TrolleyQcStatus" NOT NULL DEFAULT 'PENDING',
    "assignedEmployeeId" TEXT,
    "remarks" TEXT,

    CONSTRAINT "DryingTrolley_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiscStorageItem" (
    "id" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "batchNumber" TEXT,
    "quantityLabel" TEXT NOT NULL,
    "storageType" TEXT,
    "status" TEXT,
    "requiredAction" TEXT,
    "location" TEXT,
    "remarks" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiscStorageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "identifier" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "WhatsAppGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DryingBay_bayNumber_key" ON "DryingBay"("bayNumber");

-- CreateIndex
CREATE INDEX "DryingBatch_bayId_idx" ON "DryingBatch"("bayId");

-- CreateIndex
CREATE INDEX "DryingTrolley_batchId_idx" ON "DryingTrolley"("batchId");

-- AddForeignKey
ALTER TABLE "DryingBatch" ADD CONSTRAINT "DryingBatch_bayId_fkey" FOREIGN KEY ("bayId") REFERENCES "DryingBay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DryingTrolley" ADD CONSTRAINT "DryingTrolley_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "DryingBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
