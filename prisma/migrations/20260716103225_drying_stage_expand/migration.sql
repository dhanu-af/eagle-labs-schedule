-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DryingStage" ADD VALUE 'SORTING';
ALTER TYPE "DryingStage" ADD VALUE 'QA_QC_APPROVALS';
ALTER TYPE "DryingStage" ADD VALUE 'POLISHING';
ALTER TYPE "DryingStage" ADD VALUE 'COATING';
ALTER TYPE "DryingStage" ADD VALUE 'RE_COATING';
ALTER TYPE "DryingStage" ADD VALUE 'QUARANTINE';
