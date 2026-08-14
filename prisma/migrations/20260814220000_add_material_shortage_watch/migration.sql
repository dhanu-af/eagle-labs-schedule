-- CreateTable
CREATE TABLE "MaterialShortageWatch" (
    "id" TEXT NOT NULL,
    "warehouseItemId" TEXT NOT NULL,
    "action" TEXT,
    "owner" TEXT,
    "status" "ActionLogStatus" NOT NULL DEFAULT 'OPEN',
    "updatedById" TEXT,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialShortageWatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaterialShortageWatch_warehouseItemId_key" ON "MaterialShortageWatch"("warehouseItemId");

-- AddForeignKey
ALTER TABLE "MaterialShortageWatch" ADD CONSTRAINT "MaterialShortageWatch_warehouseItemId_fkey" FOREIGN KEY ("warehouseItemId") REFERENCES "WarehouseItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

