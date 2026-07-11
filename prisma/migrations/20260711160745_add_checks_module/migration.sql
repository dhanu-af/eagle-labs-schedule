-- CreateEnum
CREATE TYPE "CheckStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'APPROVED');

-- CreateEnum
CREATE TYPE "CleaningType" AS ENUM ('FULL_CLEAN', 'PROVISIONAL_CLEAN');

-- CreateEnum
CREATE TYPE "PostOpItem" AS ENUM ('BLENDING_ROOM', 'V_BLENDER_1', 'V_BLENDER_2', 'CAPSULE_ROOM', 'CAPSULE_EQUIPMENT', 'CAPSULE_MACHINE');

-- CreateEnum
CREATE TYPE "EnvArea" AS ENUM ('BLENDING_ROOM', 'CAPSULE_ROOM');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'QA';

-- CreateTable
CREATE TABLE "SupervisorPreOpCheck" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "room" TEXT NOT NULL,
    "roomCleanliness" BOOLEAN NOT NULL DEFAULT false,
    "equipmentReadiness" BOOLEAN NOT NULL DEFAULT false,
    "safetyPpeVerified" BOOLEAN NOT NULL DEFAULT false,
    "calibrationStatus" TEXT,
    "comments" TEXT,
    "status" "CheckStatus" NOT NULL DEFAULT 'COMPLETED',
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "submittedById" TEXT NOT NULL,
    "submittedByName" TEXT NOT NULL,
    "submittedByRole" "Role" NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupervisorPreOpCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QaPreOpCheck" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "room" TEXT NOT NULL,
    "qaRoomInspection" BOOLEAN NOT NULL DEFAULT false,
    "equipmentVerification" BOOLEAN NOT NULL DEFAULT false,
    "gmpCompliance" BOOLEAN NOT NULL DEFAULT false,
    "environmentalCondition" BOOLEAN NOT NULL DEFAULT false,
    "comments" TEXT,
    "status" "CheckStatus" NOT NULL DEFAULT 'COMPLETED',
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "submittedById" TEXT NOT NULL,
    "submittedByName" TEXT NOT NULL,
    "submittedByRole" "Role" NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QaPreOpCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentalCheck" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "area" "EnvArea" NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "humidity" DOUBLE PRECISION NOT NULL,
    "passFail" BOOLEAN NOT NULL,
    "remarks" TEXT,
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
    "qaApprovedById" TEXT,
    "qaApprovedByName" TEXT,
    "qaApprovedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvironmentalCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentalLimit" (
    "id" TEXT NOT NULL,
    "area" "EnvArea" NOT NULL,
    "minTemp" DOUBLE PRECISION NOT NULL,
    "maxTemp" DOUBLE PRECISION NOT NULL,
    "minRH" DOUBLE PRECISION NOT NULL,
    "maxRH" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvironmentalLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineClearance" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "line" TEXT NOT NULL,
    "previousBatchCleared" BOOLEAN NOT NULL DEFAULT false,
    "materialCleared" BOOLEAN NOT NULL DEFAULT false,
    "labelPackagingCleared" BOOLEAN NOT NULL DEFAULT false,
    "equipmentCleared" BOOLEAN NOT NULL DEFAULT false,
    "documentationVerified" BOOLEAN NOT NULL DEFAULT false,
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
    "qaApprovedById" TEXT,
    "qaApprovedByName" TEXT,
    "qaApprovedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LineClearance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostOpCheck" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "item" "PostOpItem" NOT NULL,
    "cleaningType" "CleaningType" NOT NULL,
    "cleaningVerificationStatus" TEXT,
    "comments" TEXT,
    "status" "CheckStatus" NOT NULL DEFAULT 'PENDING',
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "submittedById" TEXT NOT NULL,
    "submittedByName" TEXT NOT NULL,
    "submittedByRole" "Role" NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signature" TEXT NOT NULL,
    "verifiedById" TEXT,
    "verifiedByName" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostOpCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckAttachment" (
    "id" TEXT NOT NULL,
    "checkType" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupervisorPreOpCheck_date_idx" ON "SupervisorPreOpCheck"("date");

-- CreateIndex
CREATE INDEX "SupervisorPreOpCheck_room_idx" ON "SupervisorPreOpCheck"("room");

-- CreateIndex
CREATE INDEX "QaPreOpCheck_date_idx" ON "QaPreOpCheck"("date");

-- CreateIndex
CREATE INDEX "QaPreOpCheck_room_idx" ON "QaPreOpCheck"("room");

-- CreateIndex
CREATE INDEX "EnvironmentalCheck_date_idx" ON "EnvironmentalCheck"("date");

-- CreateIndex
CREATE INDEX "EnvironmentalCheck_area_idx" ON "EnvironmentalCheck"("area");

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentalLimit_area_key" ON "EnvironmentalLimit"("area");

-- CreateIndex
CREATE INDEX "LineClearance_date_idx" ON "LineClearance"("date");

-- CreateIndex
CREATE INDEX "PostOpCheck_date_idx" ON "PostOpCheck"("date");

-- CreateIndex
CREATE INDEX "PostOpCheck_item_idx" ON "PostOpCheck"("item");

-- CreateIndex
CREATE INDEX "CheckAttachment_checkType_checkId_idx" ON "CheckAttachment"("checkType", "checkId");
