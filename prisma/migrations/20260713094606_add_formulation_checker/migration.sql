-- CreateTable
CREATE TABLE "FormulationFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormulationFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Formulation" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "baseBatchSize" DOUBLE PRECISION NOT NULL,
    "baseUnit" TEXT NOT NULL DEFAULT 'kg',
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Formulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormulationIngredient" (
    "id" TEXT NOT NULL,
    "formulationId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "rmNumber" TEXT,
    "ingredientName" TEXT NOT NULL,
    "uin" TEXT,
    "baseQty" DOUBLE PRECISION NOT NULL,
    "controlStatus" TEXT,
    "changeControlRef" TEXT,
    "approvedBy" TEXT,
    "comments" TEXT,
    "tolerancePct" DOUBLE PRECISION NOT NULL DEFAULT 2,

    CONSTRAINT "FormulationIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormulationFolder_name_key" ON "FormulationFolder"("name");

-- CreateIndex
CREATE INDEX "Formulation_folderId_idx" ON "Formulation"("folderId");

-- CreateIndex
CREATE INDEX "FormulationIngredient_formulationId_idx" ON "FormulationIngredient"("formulationId");

-- AddForeignKey
ALTER TABLE "Formulation" ADD CONSTRAINT "Formulation_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "FormulationFolder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormulationIngredient" ADD CONSTRAINT "FormulationIngredient_formulationId_fkey" FOREIGN KEY ("formulationId") REFERENCES "Formulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
