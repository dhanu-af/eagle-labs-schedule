-- CreateEnum
CREATE TYPE "ActionSourceSection" AS ENUM ('SALES_CUSTOMER_SERVICE', 'PRODUCTION_PLANNING', 'PROCUREMENT_MATERIALS', 'WAREHOUSE', 'QC_QA', 'MAINTENANCE_ENGINEERING', 'PRODUCTION_SHIFTS', 'DISPATCH_DELIVERY', 'CROSS_FUNCTIONAL');

-- CreateEnum
CREATE TYPE "ActionLogStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "EscalationLevel" AS ENUM ('GREEN', 'AMBER', 'RED');

-- CreateTable
CREATE TABLE "SiteActionLog" (
    "id" TEXT NOT NULL,
    "actionNumber" TEXT NOT NULL,
    "dateRaised" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceSection" "ActionSourceSection" NOT NULL,
    "issue" TEXT NOT NULL,
    "businessImpact" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "owner" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "ActionLogStatus" NOT NULL DEFAULT 'OPEN',
    "escalationLevel" "EscalationLevel" NOT NULL DEFAULT 'GREEN',
    "resolution" TEXT,
    "closedDate" TIMESTAMP(3),
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteActionLog_actionNumber_key" ON "SiteActionLog"("actionNumber");

-- CreateIndex
CREATE INDEX "SiteActionLog_status_idx" ON "SiteActionLog"("status");

-- CreateIndex
CREATE INDEX "SiteActionLog_dueDate_idx" ON "SiteActionLog"("dueDate");

-- CreateIndex
CREATE INDEX "SiteActionLog_sourceSection_idx" ON "SiteActionLog"("sourceSection");

-- CreateIndex
CREATE INDEX "SiteActionLog_escalationLevel_idx" ON "SiteActionLog"("escalationLevel");

