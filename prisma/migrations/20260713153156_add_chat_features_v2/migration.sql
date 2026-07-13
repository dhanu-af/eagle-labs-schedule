-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "replyToId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastActiveAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ChatReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatReceipt" (
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatReceipt_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ChatTyping" (
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatTyping_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "ChatReaction_messageId_idx" ON "ChatReaction"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatReaction_messageId_userId_key" ON "ChatReaction"("messageId", "userId");

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatReaction" ADD CONSTRAINT "ChatReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
