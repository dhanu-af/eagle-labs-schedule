-- CreateTable
CREATE TABLE "KnowledgeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "cause" TEXT,
    "answer" TEXT NOT NULL,
    "source" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "KbQuestionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "question" TEXT NOT NULL,
    "matchedId" TEXT,
    "matchTitle" TEXT,
    "matchScore" REAL,
    "askedByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "KnowledgeEntry_category_idx" ON "KnowledgeEntry"("category");

-- CreateIndex
CREATE INDEX "KbQuestionLog_createdAt_idx" ON "KbQuestionLog"("createdAt");
