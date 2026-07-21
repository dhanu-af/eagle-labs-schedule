/*
  Warnings:

  - You are about to drop the column `finishedCapsuleWeightMg` on the `MfgEncapsulation` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MfgEncapsulation" DROP COLUMN "finishedCapsuleWeightMg",
ADD COLUMN     "finishedCapsuleWeightKg" DOUBLE PRECISION;
