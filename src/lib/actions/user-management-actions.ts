"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canEdit, hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { Role } from "@/generated/prisma";

async function requireSuperAdmin() {
  const session = await getSession();
  if (!session || !canEdit(session.role)) throw new Error("Not authorized");
  return session;
}

async function requireEditableTarget(id: string) {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new Error("User not found");
  if (target.isPermanent) {
    throw new Error("This is the protected Super Admin account and cannot be modified.");
  }
  return target;
}

export async function createUser(data: {
  fullName: string;
  username: string;
  password: string;
  role: Role;
  department?: string;
  disabled?: boolean;
}) {
  const session = await requireSuperAdmin();

  const username = data.username.trim();
  if (!username || !data.fullName.trim() || !data.password) {
    throw new Error("Full name, User ID, and password are required");
  }
  if (data.password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) throw new Error("That User ID is already taken");

  const passwordHash = await hashPassword(data.password);
  const user = await prisma.user.create({
    data: {
      username,
      fullName: data.fullName.trim(),
      passwordHash,
      role: data.role,
      department: data.department || null,
      disabled: data.disabled ?? false,
      mustChangePassword: true,
    },
  });

  await logAudit(session, {
    action: "USER_CREATED",
    entityType: "User",
    entityId: user.id,
    summary: `Created user ${user.fullName} (${user.username}), role ${user.role}`,
  });

  revalidatePath("/user-management");
}

export async function updateUser(
  id: string,
  data: { fullName: string; role: Role; department?: string; restrictedToHref?: string | null }
) {
  const session = await requireSuperAdmin();
  const target = await requireEditableTarget(id);

  await prisma.user.update({
    where: { id },
    data: {
      fullName: data.fullName.trim(),
      role: data.role,
      department: data.department || null,
      restrictedToHref: data.role === "OTHERS" ? data.restrictedToHref || null : null,
    },
  });

  if (target.employeeId) {
    await prisma.employee.update({ where: { id: target.employeeId }, data: { role: data.role } });
  }

  await logAudit(session, {
    action: "USER_EDITED",
    entityType: "User",
    entityId: id,
    summary: `Edited user ${target.username}: ${JSON.stringify(data)}`,
  });

  revalidatePath("/user-management");
}

export async function resetPassword(id: string, newPassword: string) {
  const session = await requireSuperAdmin();
  const target = await requireEditableTarget(id);

  if (newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id },
    data: { passwordHash, mustChangePassword: true },
  });

  await logAudit(session, {
    action: "PASSWORD_RESET",
    entityType: "User",
    entityId: id,
    summary: `Reset password for user ${target.username}`,
  });

  revalidatePath("/user-management");
}

export async function setUserDisabled(id: string, disabled: boolean) {
  const session = await requireSuperAdmin();
  const target = await requireEditableTarget(id);

  await prisma.user.update({ where: { id }, data: { disabled } });

  await logAudit(session, {
    action: disabled ? "USER_DISABLED" : "USER_ENABLED",
    entityType: "User",
    entityId: id,
    summary: `${disabled ? "Disabled" : "Enabled"} user ${target.username}`,
  });

  revalidatePath("/user-management");
}

export async function unlockUser(id: string) {
  const session = await requireSuperAdmin();
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new Error("User not found");

  await prisma.user.update({
    where: { id },
    data: { locked: false, failedLoginAttempts: 0 },
  });

  await logAudit(session, {
    action: "USER_UNLOCKED",
    entityType: "User",
    entityId: id,
    summary: `Unlocked user ${target.username}`,
  });

  revalidatePath("/user-management");
}

export async function deleteUser(id: string) {
  const session = await requireSuperAdmin();
  const target = await requireEditableTarget(id);

  await prisma.user.delete({ where: { id } });

  await logAudit(session, {
    action: "USER_DELETED",
    entityType: "User",
    entityId: id,
    summary: `Deleted user ${target.username}`,
  });

  revalidatePath("/user-management");
}
