-- CreateEnum
CREATE TYPE "TaskRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE');

-- CreateTable
CREATE TABLE "EmployeeTaskRequest" (
    "id" TEXT NOT NULL,
    "fromEmployeeId" TEXT NOT NULL,
    "toEmployeeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "status" "TaskRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeTaskRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeTaskRequest_toEmployeeId_status_idx" ON "EmployeeTaskRequest"("toEmployeeId", "status");

-- CreateIndex
CREATE INDEX "EmployeeTaskRequest_fromEmployeeId_idx" ON "EmployeeTaskRequest"("fromEmployeeId");

-- AddForeignKey
ALTER TABLE "EmployeeTaskRequest" ADD CONSTRAINT "EmployeeTaskRequest_fromEmployeeId_fkey" FOREIGN KEY ("fromEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTaskRequest" ADD CONSTRAINT "EmployeeTaskRequest_toEmployeeId_fkey" FOREIGN KEY ("toEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

