-- CreateEnum
CREATE TYPE "DailyTaskQcStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'HOLD');

-- AlterTable
ALTER TABLE "DailyTask" ADD COLUMN     "actualFinish" TEXT,
ADD COLUMN     "actualStart" TEXT,
ADD COLUMN     "downtimeMinutes" INTEGER,
ADD COLUMN     "qcStatus" "DailyTaskQcStatus";

