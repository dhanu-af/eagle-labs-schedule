-- DropForeignKey
ALTER TABLE "EmployeeTaskRequest" DROP CONSTRAINT "EmployeeTaskRequest_fromEmployeeId_fkey";

-- DropForeignKey
ALTER TABLE "EmployeeTaskRequest" DROP CONSTRAINT "EmployeeTaskRequest_toEmployeeId_fkey";

-- DropTable
DROP TABLE "EmployeeTaskRequest";

-- CreateTable
CREATE TABLE "TaskRequest" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "status" "TaskRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskRequest_toUserId_status_idx" ON "TaskRequest"("toUserId", "status");

-- CreateIndex
CREATE INDEX "TaskRequest_fromUserId_idx" ON "TaskRequest"("fromUserId");

-- AddForeignKey
ALTER TABLE "TaskRequest" ADD CONSTRAINT "TaskRequest_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskRequest" ADD CONSTRAINT "TaskRequest_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

