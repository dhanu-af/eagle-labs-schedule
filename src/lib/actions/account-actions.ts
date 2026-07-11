"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession, hashPassword, verifyPassword, createSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function changeOwnPassword(
  _prevState: { error?: string; ok?: boolean } | undefined,
  formData: FormData
) {
  const session = await getSession();
  if (!session) redirect("/login");

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "All fields are required." };
  }
  if (newPassword.length < 6) {
    return { error: "New password must be at least 6 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "New password and confirmation do not match." };
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) redirect("/login");

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    return { error: "Current password is incorrect." };
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  await logAudit(session, {
    action: "PASSWORD_CHANGED",
    entityType: "User",
    entityId: user.id,
    summary: `${user.fullName} (${user.username}) changed their own password`,
  });

  // Refresh the session so mustChangePassword no longer forces a redirect loop.
  await createSession({ ...session, mustChangePassword: false });

  return { ok: true };
}
