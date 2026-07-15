-- CreateTable
CREATE TABLE "BatchRecord" (
    "id" TEXT NOT NULL,
    "formulationId" TEXT,
    "productName" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "writtenByName" TEXT,
    "writtenSignedDate" TIMESTAMP(3),
    "checkedByName" TEXT,
    "checkedSignedDate" TIMESTAMP(3),
    "reviewDate" TIMESTAMP(3),
    "notes" TEXT,
    "numberOfMixes" INTEGER NOT NULL DEFAULT 1,
    "batchSizePerMix" DOUBLE PRECISION NOT NULL,
    "batchSizeUnit" TEXT NOT NULL DEFAULT 'kg',
    "declEncapsulation" BOOLEAN NOT NULL DEFAULT false,
    "declBlendingMixing" BOOLEAN NOT NULL DEFAULT false,
    "declDispensing" BOOLEAN NOT NULL DEFAULT false,
    "declPolishing" BOOLEAN NOT NULL DEFAULT false,
    "declCoating" BOOLEAN NOT NULL DEFAULT false,
    "releasedByWarehouse" TEXT,
    "releasedDate" TIMESTAMP(3),
    "requestCheckedBy" TEXT,
    "ailsNumber" TEXT,
    "palletNumber" TEXT,
    "status" "CheckStatus" NOT NULL DEFAULT 'PENDING',
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BatchRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchWorkLogEntry" (
    "id" TEXT NOT NULL,
    "batchRecordId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "date" TIMESTAMP(3),
    "operatorName" TEXT,
    "processNumber" INTEGER,
    "startTime" TEXT,
    "finishTime" TEXT,
    "breakMinutes" DOUBLE PRECISION,
    "totalHours" DOUBLE PRECISION,
    "sign" TEXT,

    CONSTRAINT "BatchWorkLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchOperatorSignoff" (
    "id" TEXT NOT NULL,
    "batchRecordId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "name" TEXT,
    "signature" TEXT,
    "date" TIMESTAMP(3),

    CONSTRAINT "BatchOperatorSignoff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchEquipmentItem" (
    "id" TEXT NOT NULL,
    "batchRecordId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "eqNumber" TEXT,
    "itemName" TEXT,
    "calibrationUpdated" TEXT,
    "notes" TEXT,

    CONSTRAINT "BatchEquipmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchLineClearance" (
    "id" TEXT NOT NULL,
    "batchRecordId" TEXT NOT NULL,
    "roomNumber" TEXT,
    "roomCleanType" TEXT,
    "equipmentCleanType" TEXT,
    "performedBySign" TEXT,
    "performedByDate" TIMESTAMP(3),
    "performedByTime" TEXT,
    "verifiedBySign" TEXT,
    "verifiedByDate" TIMESTAMP(3),
    "verifiedByTime" TEXT,
    "probioticProduct" BOOLEAN NOT NULL DEFAULT false,
    "roomRhPercent" DOUBLE PRECISION,
    "roomRhTime" TEXT,
    "roomTemperature" DOUBLE PRECISION,
    "roomTempTime" TEXT,
    "roomUseApprovalSign" TEXT,
    "roomUseApprovalDate" TIMESTAMP(3),
    "materialsIdentifiedChecked" BOOLEAN NOT NULL DEFAULT false,
    "materialsPassLabelledChecked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BatchLineClearance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchMix" (
    "id" TEXT NOT NULL,
    "batchRecordId" TEXT NOT NULL,
    "mixNumber" INTEGER NOT NULL,
    "dispensingStartDate" TIMESTAMP(3),
    "dispensingStartTime" TEXT,
    "dispensingStartSign" TEXT,
    "dispensingEndDate" TIMESTAMP(3),
    "dispensingEndTime" TEXT,
    "dispensingEndSign" TEXT,
    "blendingStartDate" TIMESTAMP(3),
    "blendingStartTime" TEXT,
    "blendingStartSign" TEXT,
    "blendingEndDate" TIMESTAMP(3),
    "blendingEndTime" TEXT,
    "blendingEndSign" TEXT,
    "mixCompletedSign" TEXT,
    "mixCompletedDate" TIMESTAMP(3),
    "mixCompletedTime" TEXT,
    "verifiedBySign" TEXT,
    "verifiedByDate" TIMESTAMP(3),
    "verifiedByTime" TEXT,
    "samplesRejectsSpillsKg" DOUBLE PRECISION,
    "bulkSampleWeightG" DOUBLE PRECISION,
    "bulkVolumeMl" DOUBLE PRECISION,
    "tappedVolumeMl" DOUBLE PRECISION,

    CONSTRAINT "BatchMix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchDispensingLine" (
    "id" TEXT NOT NULL,
    "mixId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "rmNumber" TEXT,
    "ingredientName" TEXT NOT NULL,
    "uin" TEXT,
    "requiredQtyKg" DOUBLE PRECISION NOT NULL,
    "actualQtyDispensedKg" DOUBLE PRECISION,
    "performedBySign" TEXT,
    "performedByDate" TIMESTAMP(3),
    "verifiedBySign" TEXT,
    "verifiedByDate" TIMESTAMP(3),

    CONSTRAINT "BatchDispensingLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchDrum" (
    "id" TEXT NOT NULL,
    "mixId" TEXT NOT NULL,
    "drumNumber" TEXT,
    "netWeightKg" DOUBLE PRECISION,
    "passLabelAttached" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BatchDrum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchWarehouseReturnLine" (
    "id" TEXT NOT NULL,
    "batchRecordId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "rmNumber" TEXT,
    "ingredientName" TEXT NOT NULL,
    "uin" TEXT,
    "kgPerBatch" DOUBLE PRECISION,
    "qtyUsedKg" DOUBLE PRECISION,
    "actualQtyReturnedKg" DOUBLE PRECISION,
    "operatorSign" TEXT,
    "operatorDate" TIMESTAMP(3),

    CONSTRAINT "BatchWarehouseReturnLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchMaterialRequestLine" (
    "id" TEXT NOT NULL,
    "batchRecordId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "rmNumber" TEXT,
    "ingredientName" TEXT NOT NULL,
    "uin" TEXT,
    "kgPerBatch" DOUBLE PRECISION,
    "qtyReleasedKg" DOUBLE PRECISION,
    "actualQtyReceivedKg" DOUBLE PRECISION,
    "operatorSign" TEXT,
    "operatorDate" TIMESTAMP(3),

    CONSTRAINT "BatchMaterialRequestLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BatchRecord_formulationId_idx" ON "BatchRecord"("formulationId");

-- CreateIndex
CREATE INDEX "BatchRecord_batchNumber_idx" ON "BatchRecord"("batchNumber");

-- CreateIndex
CREATE INDEX "BatchWorkLogEntry_batchRecordId_idx" ON "BatchWorkLogEntry"("batchRecordId");

-- CreateIndex
CREATE INDEX "BatchOperatorSignoff_batchRecordId_idx" ON "BatchOperatorSignoff"("batchRecordId");

-- CreateIndex
CREATE INDEX "BatchEquipmentItem_batchRecordId_idx" ON "BatchEquipmentItem"("batchRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "BatchLineClearance_batchRecordId_key" ON "BatchLineClearance"("batchRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "BatchMix_batchRecordId_mixNumber_key" ON "BatchMix"("batchRecordId", "mixNumber");

-- CreateIndex
CREATE INDEX "BatchDispensingLine_mixId_idx" ON "BatchDispensingLine"("mixId");

-- CreateIndex
CREATE INDEX "BatchDrum_mixId_idx" ON "BatchDrum"("mixId");

-- CreateIndex
CREATE INDEX "BatchWarehouseReturnLine_batchRecordId_idx" ON "BatchWarehouseReturnLine"("batchRecordId");

-- CreateIndex
CREATE INDEX "BatchMaterialRequestLine_batchRecordId_idx" ON "BatchMaterialRequestLine"("batchRecordId");

-- AddForeignKey
ALTER TABLE "BatchRecord" ADD CONSTRAINT "BatchRecord_formulationId_fkey" FOREIGN KEY ("formulationId") REFERENCES "Formulation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchWorkLogEntry" ADD CONSTRAINT "BatchWorkLogEntry_batchRecordId_fkey" FOREIGN KEY ("batchRecordId") REFERENCES "BatchRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchOperatorSignoff" ADD CONSTRAINT "BatchOperatorSignoff_batchRecordId_fkey" FOREIGN KEY ("batchRecordId") REFERENCES "BatchRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchEquipmentItem" ADD CONSTRAINT "BatchEquipmentItem_batchRecordId_fkey" FOREIGN KEY ("batchRecordId") REFERENCES "BatchRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchLineClearance" ADD CONSTRAINT "BatchLineClearance_batchRecordId_fkey" FOREIGN KEY ("batchRecordId") REFERENCES "BatchRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchMix" ADD CONSTRAINT "BatchMix_batchRecordId_fkey" FOREIGN KEY ("batchRecordId") REFERENCES "BatchRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchDispensingLine" ADD CONSTRAINT "BatchDispensingLine_mixId_fkey" FOREIGN KEY ("mixId") REFERENCES "BatchMix"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchDrum" ADD CONSTRAINT "BatchDrum_mixId_fkey" FOREIGN KEY ("mixId") REFERENCES "BatchMix"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchWarehouseReturnLine" ADD CONSTRAINT "BatchWarehouseReturnLine_batchRecordId_fkey" FOREIGN KEY ("batchRecordId") REFERENCES "BatchRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchMaterialRequestLine" ADD CONSTRAINT "BatchMaterialRequestLine_batchRecordId_fkey" FOREIGN KEY ("batchRecordId") REFERENCES "BatchRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
