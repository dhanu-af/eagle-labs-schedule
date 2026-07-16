-- CreateEnum
CREATE TYPE "WarehouseItemCategory" AS ENUM ('RAW_MATERIAL', 'PACKAGING', 'CONSUMABLE', 'FINISHED_GOOD');

-- CreateEnum
CREATE TYPE "WarehouseZone" AS ENUM ('DRY_STORE', 'COLD_STORE', 'QUARANTINE', 'RELEASED', 'REJECTED', 'PACKAGING', 'FINISHED_GOODS');

-- CreateEnum
CREATE TYPE "GoodsReceivingLineStatus" AS ENUM ('QUARANTINE', 'RELEASED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WarehouseRequestStatus" AS ENUM ('REQUESTED', 'WAREHOUSE_PREPARING', 'RELEASED', 'WAITING_PRODUCTION_CONFIRMATION', 'PARTIALLY_RECEIVED', 'RECEIVED', 'IN_PRODUCTION', 'RETURN_PENDING', 'WAREHOUSE_VERIFYING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ReceiptOutcome" AS ENUM ('ACCEPTED', 'REJECTED', 'SHORTAGE', 'DAMAGED');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('RECEIPT', 'RESERVE', 'ISSUE', 'RETURN', 'ADJUSTMENT', 'RECOUNT', 'STATUS_CHANGE');

-- CreateEnum
CREATE TYPE "StockBucket" AS ENUM ('AVAILABLE', 'RESERVED', 'IN_PRODUCTION', 'AWAITING_VERIFICATION', 'EXPIRED', 'DAMAGED', 'BLOCKED');

-- CreateTable
CREATE TABLE "WarehouseLocation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "zone" "WarehouseZone" NOT NULL,
    "parentId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseItem" (
    "id" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "WarehouseItemCategory" NOT NULL,
    "subCategory" TEXT,
    "ingredientId" TEXT,
    "unit" TEXT NOT NULL,
    "minimumStock" DOUBLE PRECISION,
    "maximumStock" DOUBLE PRECISION,
    "defaultLocationId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceiving" (
    "id" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "poNumber" TEXT,
    "deliveryDate" TIMESTAMP(3) NOT NULL,
    "invoiceRef" TEXT,
    "receivedByName" TEXT NOT NULL,
    "checkedByName" TEXT,
    "approvedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoodsReceiving_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceivingLine" (
    "id" TEXT NOT NULL,
    "goodsReceivingId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "supplierLot" TEXT,
    "internalLot" TEXT,
    "expiryDate" TIMESTAMP(3),
    "manufactureDate" TIMESTAMP(3),
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "coaReference" TEXT,
    "photoReference" TEXT,
    "deliveryDocketReference" TEXT,
    "storageCondition" TEXT,
    "status" "GoodsReceivingLineStatus" NOT NULL DEFAULT 'QUARANTINE',
    "locationId" TEXT,
    "qaReleasedByName" TEXT,
    "qaReleasedAt" TIMESTAMP(3),
    "qaRejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoodsReceivingLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseMaterialRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "batchReference" TEXT NOT NULL,
    "batchSize" DOUBLE PRECISION,
    "batchSizeUnit" TEXT,
    "requiredDate" TIMESTAMP(3),
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "WarehouseRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedByName" TEXT NOT NULL,
    "formulationId" TEXT,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseMaterialRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseRequestLine" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "itemId" TEXT,
    "ingredientNameFreeText" TEXT,
    "requestedQty" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "releasedQty" DOUBLE PRECISION,
    "releaseLotNumber" TEXT,
    "releaseExpiry" TIMESTAMP(3),
    "releaseLocationId" TEXT,
    "releasedByName" TEXT,
    "releasedAt" TIMESTAMP(3),
    "releaseComments" TEXT,
    "receiptOutcome" "ReceiptOutcome",
    "receivedQty" DOUBLE PRECISION,
    "receivedByName" TEXT,
    "receivedAt" TIMESTAMP(3),
    "receiptComments" TEXT,
    "usedQty" DOUBLE PRECISION,
    "wasteQty" DOUBLE PRECISION,
    "returnQty" DOUBLE PRECISION,
    "returnConditionNotes" TEXT,
    "returnLocationId" TEXT,
    "returnSubmittedByName" TEXT,
    "returnSubmittedAt" TIMESTAMP(3),
    "returnVerifiedByName" TEXT,
    "returnVerifiedAt" TIMESTAMP(3),
    "returnQaApprovedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseRequestLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialLedgerEntry" (
    "id" TEXT NOT NULL,
    "sequence" SERIAL NOT NULL,
    "entryType" "LedgerEntryType" NOT NULL,
    "itemId" TEXT NOT NULL,
    "lotNumber" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "fromBucket" "StockBucket",
    "toBucket" "StockBucket",
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "batchReference" TEXT,
    "requestId" TEXT,
    "requestLineId" TEXT,
    "goodsReceivingLineId" TEXT,
    "performedByName" TEXT NOT NULL,
    "approvedByName" TEXT,
    "reasonCode" TEXT,
    "resultingBalance" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseLocation_code_key" ON "WarehouseLocation"("code");

-- CreateIndex
CREATE INDEX "WarehouseLocation_zone_idx" ON "WarehouseLocation"("zone");

-- CreateIndex
CREATE INDEX "WarehouseLocation_parentId_idx" ON "WarehouseLocation"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseItem_itemCode_key" ON "WarehouseItem"("itemCode");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseItem_ingredientId_key" ON "WarehouseItem"("ingredientId");

-- CreateIndex
CREATE INDEX "WarehouseItem_category_idx" ON "WarehouseItem"("category");

-- CreateIndex
CREATE INDEX "WarehouseItem_ingredientId_idx" ON "WarehouseItem"("ingredientId");

-- CreateIndex
CREATE INDEX "GoodsReceiving_deliveryDate_idx" ON "GoodsReceiving"("deliveryDate");

-- CreateIndex
CREATE INDEX "GoodsReceivingLine_goodsReceivingId_idx" ON "GoodsReceivingLine"("goodsReceivingId");

-- CreateIndex
CREATE INDEX "GoodsReceivingLine_itemId_idx" ON "GoodsReceivingLine"("itemId");

-- CreateIndex
CREATE INDEX "GoodsReceivingLine_status_idx" ON "GoodsReceivingLine"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseMaterialRequest_requestNumber_key" ON "WarehouseMaterialRequest"("requestNumber");

-- CreateIndex
CREATE INDEX "WarehouseMaterialRequest_status_idx" ON "WarehouseMaterialRequest"("status");

-- CreateIndex
CREATE INDEX "WarehouseMaterialRequest_batchReference_idx" ON "WarehouseMaterialRequest"("batchReference");

-- CreateIndex
CREATE INDEX "WarehouseRequestLine_requestId_idx" ON "WarehouseRequestLine"("requestId");

-- CreateIndex
CREATE INDEX "WarehouseRequestLine_itemId_idx" ON "WarehouseRequestLine"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialLedgerEntry_sequence_key" ON "MaterialLedgerEntry"("sequence");

-- CreateIndex
CREATE INDEX "MaterialLedgerEntry_itemId_lotNumber_idx" ON "MaterialLedgerEntry"("itemId", "lotNumber");

-- CreateIndex
CREATE INDEX "MaterialLedgerEntry_requestId_idx" ON "MaterialLedgerEntry"("requestId");

-- CreateIndex
CREATE INDEX "MaterialLedgerEntry_entryType_idx" ON "MaterialLedgerEntry"("entryType");

-- CreateIndex
CREATE INDEX "MaterialLedgerEntry_createdAt_idx" ON "MaterialLedgerEntry"("createdAt");

-- AddForeignKey
ALTER TABLE "WarehouseLocation" ADD CONSTRAINT "WarehouseLocation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseItem" ADD CONSTRAINT "WarehouseItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseItem" ADD CONSTRAINT "WarehouseItem_defaultLocationId_fkey" FOREIGN KEY ("defaultLocationId") REFERENCES "WarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceivingLine" ADD CONSTRAINT "GoodsReceivingLine_goodsReceivingId_fkey" FOREIGN KEY ("goodsReceivingId") REFERENCES "GoodsReceiving"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceivingLine" ADD CONSTRAINT "GoodsReceivingLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "WarehouseItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceivingLine" ADD CONSTRAINT "GoodsReceivingLine_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseMaterialRequest" ADD CONSTRAINT "WarehouseMaterialRequest_formulationId_fkey" FOREIGN KEY ("formulationId") REFERENCES "Formulation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseRequestLine" ADD CONSTRAINT "WarehouseRequestLine_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "WarehouseMaterialRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseRequestLine" ADD CONSTRAINT "WarehouseRequestLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "WarehouseItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseRequestLine" ADD CONSTRAINT "WarehouseRequestLine_releaseLocationId_fkey" FOREIGN KEY ("releaseLocationId") REFERENCES "WarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseRequestLine" ADD CONSTRAINT "WarehouseRequestLine_returnLocationId_fkey" FOREIGN KEY ("returnLocationId") REFERENCES "WarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialLedgerEntry" ADD CONSTRAINT "MaterialLedgerEntry_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "WarehouseItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialLedgerEntry" ADD CONSTRAINT "MaterialLedgerEntry_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "WarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialLedgerEntry" ADD CONSTRAINT "MaterialLedgerEntry_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "WarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialLedgerEntry" ADD CONSTRAINT "MaterialLedgerEntry_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "WarehouseMaterialRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialLedgerEntry" ADD CONSTRAINT "MaterialLedgerEntry_requestLineId_fkey" FOREIGN KEY ("requestLineId") REFERENCES "WarehouseRequestLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialLedgerEntry" ADD CONSTRAINT "MaterialLedgerEntry_goodsReceivingLineId_fkey" FOREIGN KEY ("goodsReceivingLineId") REFERENCES "GoodsReceivingLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
