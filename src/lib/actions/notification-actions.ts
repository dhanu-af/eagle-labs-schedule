"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function markNotificationRead(id: string) {
  const session = await getSession();
  if (!session?.employeeId) throw new Error("Not authorized");

  await prisma.notification.updateMany({
    where: { id, employeeId: session.employeeId },
    data: { read: true },
  });

  revalidatePath("/");
}

export async function markAllNotificationsRead() {
  const session = await getSession();
  if (!session?.employeeId) throw new Error("Not authorized");

  await prisma.notification.updateMany({
    where: { employeeId: session.employeeId, read: false },
    data: { read: true },
  });

  revalidatePath("/");
}
