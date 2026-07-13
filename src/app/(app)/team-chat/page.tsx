import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import TeamChatClient from "./team-chat-client";

const ONLINE_WINDOW_MS = 30_000;

export default async function TeamChatPage() {
  const session = await getSession();

  const [messages, users, receipts] = await Promise.all([
    prisma.chatMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        replyTo: { select: { id: true, authorName: true, message: true } },
        reactions: { select: { userId: true, userName: true, emoji: true } },
      },
    }),
    prisma.user.findMany({
      where: { disabled: false },
      select: { id: true, fullName: true, lastActiveAt: true },
    }),
    prisma.chatReceipt.findMany(),
  ]);

  const onlineCutoff = Date.now() - ONLINE_WINDOW_MS;

  return (
    <TeamChatClient
      currentUserId={session?.userId ?? null}
      messages={messages
        .slice()
        .reverse()
        .map((m) => ({
          id: m.id,
          authorId: m.authorId,
          authorName: m.authorName,
          authorRole: m.authorRole,
          message: m.message,
          createdAt: m.createdAt.toISOString(),
          editedAt: m.editedAt?.toISOString() ?? null,
          replyTo: m.replyTo,
          reactions: m.reactions,
        }))}
      roster={users.map((u) => ({ id: u.id, name: u.fullName }))}
      initialOnlineUserIds={users
        .filter((u) => (u.lastActiveAt?.getTime() ?? 0) >= onlineCutoff)
        .map((u) => u.id)}
      initialReceipts={Object.fromEntries(receipts.map((r) => [r.userId, r.lastReadAt.toISOString()]))}
    />
  );
}
