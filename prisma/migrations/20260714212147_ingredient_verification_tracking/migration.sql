-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN     "verificationSource" TEXT,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ALTER COLUMN "notes" DROP NOT NULL;
