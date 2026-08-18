-- AlterTable
ALTER TABLE "GoodsReceiving" ADD COLUMN     "purchaseOrderId" TEXT;

-- CreateIndex
CREATE INDEX "GoodsReceiving_purchaseOrderId_idx" ON "GoodsReceiving"("purchaseOrderId");

-- AddForeignKey
ALTER TABLE "GoodsReceiving" ADD CONSTRAINT "GoodsReceiving_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
