"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canUseTeamChat } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const CHAT_PATH = "/team-chat";
const ONLINE_WINDOW_MS = 30_000;
const TYPING_WINDOW_MS = 5_000;

async function requireChatSession() {
  const session = await getSession();
  if (!session || !canUseTeamChat(session.role)) throw new Error("Not authorized");
  return session;
}

export async function sendChatMessage(message: string, replyToId?: string) {
  const session = await requireChatSession();
  if (!message.trim()) throw new Error("Message can't be empty");

  await prisma.chatMessage.create({
    data: {
      authorId: session.userId,
      authorName: session.fullName,
      authorRole: session.role,
      message: message.trim(),
      replyToId: replyToId || undefined,
    },
  });

  revalidatePath(CHAT_PATH);
}

export async function editChatMessage(id: string, message: string) {
  const session = await requireChatSession();
  if (!message.trim()) throw new Error("Message can't be empty");

  const existing = await prisma.chatMessage.findUnique({ where: { id } });
  if (!existing) throw new Error("Message not found");
  if (existing.authorId !== session.userId) throw new Error("You can only edit your own messages");

  await prisma.chatMessage.update({
    where: { id },
    data: { message: message.trim(), editedAt: new Date() },
  });

  await logAudit(session, {
    action: "EDIT_CHAT_MESSAGE",
    entityType: "ChatMessage",
    entityId: id,
    summary: `Edited a Team Chat message`,
  });

  revalidatePath(CHAT_PATH);
}

export async function deleteChatMessage(id: string) {
  const session = await requireChatSession();

  const existing = await prisma.chatMessage.findUnique({ where: { id } });
  if (!existing) return;
  if (existing.authorId !== session.userId) throw new Error("You can only delete your own messages");

  await prisma.chatMessage.delete({ where: { id } });

  await logAudit(session, {
    action: "DELETE_CHAT_MESSAGE",
    entityType: "ChatMessage",
    entityId: id,
    summary: `Deleted a Team Chat message`,
  });

  revalidatePath(CHAT_PATH);
}

export async function toggleChatReaction(messageId: string, emoji: string) {
  const session = await requireChatSession();

  const existing = await prisma.chatReaction.findUnique({
    where: { messageId_userId: { messageId, userId: session.userId } },
  });

  if (existing && existing.emoji === emoji) {
    await prisma.chatReaction.delete({ where: { id: existing.id } });
  } else if (existing) {
    await prisma.chatReaction.update({ where: { id: existing.id }, data: { emoji } });
  } else {
    await prisma.chatReaction.create({
      data: { messageId, userId: session.userId, userName: session.fullName, emoji },
    });
  }

  revalidatePath(CHAT_PATH);
}

/** Marks the shared room as read up to now for the current user. No revalidate — piggybacks on the next poll. */
export async function markChatRead() {
  const session = await requireChatSession();
  await prisma.chatReceipt.upsert({
    where: { userId: session.userId },
    update: { lastReadAt: new Date() },
    create: { userId: session.userId, lastReadAt: new Date() },
  });
}

/** Heartbeat for presence. No revalidate — piggybacks on the next poll. */
export async function pingPresence() {
  const session = await getSession();
  if (!session) return;
  await prisma.user.update({
    where: { id: session.userId },
    data: { lastActiveAt: new Date() },
  });
}

/** Marks the current user as actively typing. No revalidate — read by the fast presence poll. */
export async function setTyping() {
  const session = await requireChatSession();
  await prisma.chatTyping.upsert({
    where: { userId: session.userId },
    update: { userName: session.fullName, updatedAt: new Date() },
    create: { userId: session.userId, userName: session.fullName },
  });
}

export type ChatPresence = {
  onlineUserIds: string[];
  typingNames: string[];
  receipts: Record<string, string>;
};

/** Lightweight, frequently-polled snapshot — deliberately excludes the message list itself. */
export async function getChatPresence(): Promise<ChatPresence> {
  const session = await getSession();
  const now = Date.now();

  const [onlineUsers, typing, receipts] = await Promise.all([
    prisma.user.findMany({
      where: { lastActiveAt: { gte: new Date(now - ONLINE_WINDOW_MS) } },
      select: { id: true },
    }),
    prisma.chatTyping.findMany({
      where: { updatedAt: { gte: new Date(now - TYPING_WINDOW_MS) } },
    }),
    prisma.chatReceipt.findMany(),
  ]);

  return {
    onlineUserIds: onlineUsers.map((u) => u.id),
    typingNames: typing
      .filter((t) => t.userId !== session?.userId)
      .map((t) => t.userName),
    receipts: Object.fromEntries(receipts.map((r) => [r.userId, r.lastReadAt.toISOString()])),
  };
}
