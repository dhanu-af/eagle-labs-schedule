-- CreateTable
CREATE TABLE "WeeklyMpsEntry" (
    "id" TEXT NOT NULL,
    "weekEnding" TIMESTAMP(3) NOT NULL,
    "machineId" TEXT,
    "productId" TEXT NOT NULL,
    "batchSizeKg" DOUBLE PRECISION NOT NULL,
    "plannedBatches" INTEGER NOT NULL DEFAULT 1,
    "requiredDate" TIMESTAMP(3),
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "frozen" BOOLEAN NOT NULL DEFAULT false,
    "qcReady" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceReady" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyMpsEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyMpsEntry_weekEnding_idx" ON "WeeklyMpsEntry"("weekEnding");

-- CreateIndex
CREATE INDEX "WeeklyMpsEntry_machineId_idx" ON "WeeklyMpsEntry"("machineId");

-- CreateIndex
CREATE INDEX "WeeklyMpsEntry_productId_idx" ON "WeeklyMpsEntry"("productId");

-- AddForeignKey
ALTER TABLE "WeeklyMpsEntry" ADD CONSTRAINT "WeeklyMpsEntry_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyMpsEntry" ADD CONSTRAINT "WeeklyMpsEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

