-- CreateTable
CREATE TABLE "KpiDailyTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kpiId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "target" REAL NOT NULL,
    CONSTRAINT "KpiDailyTarget_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "Kpi" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "KpiDailyTarget_date_idx" ON "KpiDailyTarget"("date");

-- CreateIndex
CREATE UNIQUE INDEX "KpiDailyTarget_kpiId_date_key" ON "KpiDailyTarget"("kpiId", "date");
