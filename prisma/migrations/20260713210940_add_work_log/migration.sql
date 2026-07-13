-- CreateEnum
CREATE TYPE "WorkLogRoom" AS ENUM ('ENCAPSULATION_ROOM', 'BLENDING_ROOM');

-- CreateEnum
CREATE TYPE "WorkLogActivity" AS ENUM ('ENCAPSULATION', 'DISPENSING_MIXING', 'GUMMY_POLISHING', 'SORTING_REWORK', 'PACKING', 'GUMMY_COATING', 'POLISHING', 'SET_UP', 'TESTING', 'CLEANING_PROVISIONAL', 'CLEANING_FULL', 'OTHERS', 'BREAKDOWN');

-- CreateTable
CREATE TABLE "WorkLog" (
    "id" TEXT NOT NULL,
    "room" "WorkLogRoom" NOT NULL,
    "opName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "activity" "WorkLogActivity" NOT NULL,
    "activityOther" TEXT,
    "endDate" TIMESTAMP(3),
    "endTime" TEXT,
    "closingOpName" TEXT,
    "comments" TEXT,
    "status" "CheckStatus" NOT NULL DEFAULT 'PENDING',
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "submittedById" TEXT NOT NULL,
    "submittedByName" TEXT NOT NULL,
    "submittedByRole" "Role" NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signature" TEXT NOT NULL,
    "supervisorApprovedById" TEXT,
    "supervisorApprovedByName" TEXT,
    "supervisorApprovedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkLog_startDate_idx" ON "WorkLog"("startDate");

-- CreateIndex
CREATE INDEX "WorkLog_room_idx" ON "WorkLog"("room");
