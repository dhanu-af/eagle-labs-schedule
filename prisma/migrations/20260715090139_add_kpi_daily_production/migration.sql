-- CreateTable
CREATE TABLE "KpiDailyProduction" (
    "id" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "batchWeightKg" DOUBLE PRECISION,
    "fillWeightMg" DOUBLE PRECISION,
    "capsulesPerBottle" INTEGER,
    "productionTimeHours" DOUBLE PRECISION,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiDailyProduction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KpiDailyProduction_date_idx" ON "KpiDailyProduction"("date");

-- CreateIndex
CREATE UNIQUE INDEX "KpiDailyProduction_kpiId_date_key" ON "KpiDailyProduction"("kpiId", "date");

-- AddForeignKey
ALTER TABLE "KpiDailyProduction" ADD CONSTRAINT "KpiDailyProduction_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "Kpi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
