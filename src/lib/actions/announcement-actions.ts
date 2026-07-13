"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canEdit, canPostAnnouncement } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyAllEmployees } from "@/lib/notify";

export async function createAnnouncement(message: string) {
  const session = await getSession();
  if (!session || !canPostAnnouncement(session.role)) {
    throw new Error("Not authorized");
  }
  if (!message.trim()) {
    throw new Error("Announcement can't be empty");
  }

  const announcement = await prisma.announcement.create({
    data: {
      title: "Announcement",
      message: message.trim(),
      authorId: session.userId,
      authorName: session.fullName,
      authorRole: session.role,
    },
  });

  await logAudit(session, {
    action: "CREATE_ANNOUNCEMENT",
    entityType: "Announcement",
    entityId: announcement.id,
    summary: `Posted announcement: ${message.trim().slice(0, 80)}`,
  });

  await notifyAllEmployees({
    title: "New announcement",
    message: message.trim(),
    type: "ANNOUNCEMENT",
  });

  revalidatePath("/");
}

export async function updateAnnouncement(id: string, message: string) {
  const session = await getSession();
  if (!session || !canEdit(session.role)) {
    throw new Error("Not authorized");
  }

  await prisma.announcement.update({ where: { id }, data: { message } });

  await logAudit(session, {
    action: "UPDATE_ANNOUNCEMENT",
    entityType: "Announcement",
    entityId: id,
    summary: `Updated announcement ${id}`,
  });

  revalidatePath("/");
}
