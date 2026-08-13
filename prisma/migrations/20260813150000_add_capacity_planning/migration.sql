-- AlterTable
ALTER TABLE "BatchRecord" ADD COLUMN     "estimatedHours" DOUBLE PRECISION,
ADD COLUMN     "machineId" TEXT,
ADD COLUMN     "scheduledDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workCenter" TEXT,
    "standardHoursPerDay" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineCapacityException" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "hoursAvailableOverride" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MachineCapacityException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Machine_code_key" ON "Machine"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MachineCapacityException_machineId_date_key" ON "MachineCapacityException"("machineId", "date");

-- CreateIndex
CREATE INDEX "BatchRecord_machineId_scheduledDate_idx" ON "BatchRecord"("machineId", "scheduledDate");

-- AddForeignKey
ALTER TABLE "BatchRecord" ADD CONSTRAINT "BatchRecord_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineCapacityException" ADD CONSTRAINT "MachineCapacityException_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

