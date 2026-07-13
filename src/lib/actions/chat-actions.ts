"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canUseTeamChat } from "@/lib/auth";

const CHAT_PATH = "/team-chat";

export async function sendChatMessage(message: string) {
  const session = await getSession();
  if (!session || !canUseTeamChat(session.role)) throw new Error("Not authorized");
  if (!message.trim()) throw new Error("Message can't be empty");

  await prisma.chatMessage.create({
    data: {
      authorId: session.userId,
      authorName: session.fullName,
      authorRole: session.role,
      message: message.trim(),
    },
  });

  revalidatePath(CHAT_PATH);
}
