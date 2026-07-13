import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import TeamChatClient from "./team-chat-client";

export default async function TeamChatPage() {
  const session = await getSession();

  const messages = await prisma.chatMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

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
        }))}
    />
  );
}
