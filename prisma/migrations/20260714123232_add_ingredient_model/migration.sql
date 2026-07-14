-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "alternateName" TEXT,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "aanLabel" TEXT,
    "aanValue" TEXT,
    "notes" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ingredient_type_idx" ON "Ingredient"("type");

-- CreateIndex
CREATE INDEX "Ingredient_category_idx" ON "Ingredient"("category");
