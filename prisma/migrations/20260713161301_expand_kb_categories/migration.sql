-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "KbCategory" ADD VALUE 'QUALITY_CONTROL';
ALTER TYPE "KbCategory" ADD VALUE 'QUALITY_ASSURANCE';
ALTER TYPE "KbCategory" ADD VALUE 'HACCP';
ALTER TYPE "KbCategory" ADD VALUE 'SQF';
ALTER TYPE "KbCategory" ADD VALUE 'GMP';
ALTER TYPE "KbCategory" ADD VALUE 'GDP';
ALTER TYPE "KbCategory" ADD VALUE 'FOOD_SAFETY';
ALTER TYPE "KbCategory" ADD VALUE 'MANUAL_HANDLING';
ALTER TYPE "KbCategory" ADD VALUE 'RAW_MATERIALS_INGREDIENTS';
ALTER TYPE "KbCategory" ADD VALUE 'FORMULATIONS';
ALTER TYPE "KbCategory" ADD VALUE 'PRODUCTION';
ALTER TYPE "KbCategory" ADD VALUE 'PACKAGING';
ALTER TYPE "KbCategory" ADD VALUE 'EQUIPMENT_MAINTENANCE';
ALTER TYPE "KbCategory" ADD VALUE 'CLEANING_SANITATION';
ALTER TYPE "KbCategory" ADD VALUE 'ENVIRONMENTAL_MONITORING';
ALTER TYPE "KbCategory" ADD VALUE 'WHS';
ALTER TYPE "KbCategory" ADD VALUE 'TEAMWORK_COMMUNICATION';
ALTER TYPE "KbCategory" ADD VALUE 'TRAINING_INDUCTION';
ALTER TYPE "KbCategory" ADD VALUE 'SOPS';
ALTER TYPE "KbCategory" ADD VALUE 'POLICIES_PROCEDURES';
