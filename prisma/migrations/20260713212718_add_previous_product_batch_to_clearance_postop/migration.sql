-- AlterTable
ALTER TABLE "LineClearance" ADD COLUMN     "previousBatchNumber" TEXT,
ADD COLUMN     "previousProductName" TEXT;

-- AlterTable
ALTER TABLE "PostOpCheck" ADD COLUMN     "previousBatchNumber" TEXT,
ADD COLUMN     "previousProductName" TEXT;
