-- CreateTable
CREATE TABLE "WeeklyKpiScorecard" (
    "id" TEXT NOT NULL,
    "weekEnding" TIMESTAMP(3) NOT NULL,
    "otifPct" DOUBLE PRECISION,
    "scheduleAdherencePct" DOUBLE PRECISION,
    "materialAvailabilityPct" DOUBLE PRECISION,
    "productionAttainmentPct" DOUBLE PRECISION,
    "averageYieldPct" DOUBLE PRECISION,
    "qcOnTimeReleasePct" DOUBLE PRECISION,
    "inventoryAccuracyPct" DOUBLE PRECISION,
    "pastDueOrders" INTEGER,
    "criticalShortages" INTEGER,
    "unplannedScheduleChanges" INTEGER,
    "overallStatus" "EscalationLevel" NOT NULL DEFAULT 'GREEN',
    "managementComment" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyKpiScorecard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyKpiScorecard_weekEnding_key" ON "WeeklyKpiScorecard"("weekEnding");

-- CreateIndex
CREATE INDEX "WeeklyKpiScorecard_weekEnding_idx" ON "WeeklyKpiScorecard"("weekEnding");

