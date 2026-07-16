-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DryingBayPurpose" ADD VALUE 'SORTING_REQUIRED';
ALTER TYPE "DryingBayPurpose" ADD VALUE 'COATING_REQUIRED';
ALTER TYPE "DryingBayPurpose" ADD VALUE 'POLISHING_REQUIRED';
ALTER TYPE "DryingBayPurpose" ADD VALUE 'MANUAL_PACKING_REQUIRED';
ALTER TYPE "DryingBayPurpose" ADD VALUE 'CLEANED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DryingStage" ADD VALUE 'SORTING_REQUIRED';
ALTER TYPE "DryingStage" ADD VALUE 'COATING_REQUIRED';
ALTER TYPE "DryingStage" ADD VALUE 'POLISHING_REQUIRED';
ALTER TYPE "DryingStage" ADD VALUE 'MANUAL_PACKING_REQUIRED';
ALTER TYPE "DryingStage" ADD VALUE 'CLEANED';

-- AlterTable
ALTER TABLE "DryingBay" ADD COLUMN     "comments" TEXT;
