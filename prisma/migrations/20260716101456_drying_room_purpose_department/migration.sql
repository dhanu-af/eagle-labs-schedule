-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DryingBayPurpose" ADD VALUE 'READY_FOR_PRODUCTION';
ALTER TYPE "DryingBayPurpose" ADD VALUE 'SORTING';
ALTER TYPE "DryingBayPurpose" ADD VALUE 'QA_QC_APPROVALS';
ALTER TYPE "DryingBayPurpose" ADD VALUE 'POLISHING';
ALTER TYPE "DryingBayPurpose" ADD VALUE 'COATING';
ALTER TYPE "DryingBayPurpose" ADD VALUE 'RE_COATING';
ALTER TYPE "DryingBayPurpose" ADD VALUE 'QUARANTINE';

-- AlterTable
ALTER TABLE "DryingBay" ADD COLUMN     "department" TEXT;
