-- CreateTable
CREATE TABLE "CapacityRecoveryAction" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "weekEnding" TIMESTAMP(3) NOT NULL,
    "recoveryAction" TEXT,
    "owner" TEXT,
    "status" "ActionLogStatus" NOT NULL DEFAULT 'OPEN',
    "updatedById" TEXT,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapacityRecoveryAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CapacityRecoveryAction_weekEnding_idx" ON "CapacityRecoveryAction"("weekEnding");

-- CreateIndex
CREATE UNIQUE INDEX "CapacityRecoveryAction_machineId_weekEnding_key" ON "CapacityRecoveryAction"("machineId", "weekEnding");

-- AddForeignKey
ALTER TABLE "CapacityRecoveryAction" ADD CONSTRAINT "CapacityRecoveryAction_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

