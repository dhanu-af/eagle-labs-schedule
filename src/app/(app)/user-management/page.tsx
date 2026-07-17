import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession, canEdit } from "@/lib/auth";
import UserManagementClient from "./user-management-client";

export default async function UserManagementPage() {
  const session = await getSession();
  if (!session || !canEdit(session.role)) redirect("/");

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <UserManagementClient
      currentUserId={session.userId}
      users={users.map((u) => ({
        id: u.id,
        username: u.username,
        fullName: u.fullName,
        role: u.role,
        department: u.department,
        disabled: u.disabled,
        locked: u.locked,
        isPermanent: u.isPermanent,
        restrictedToHref: u.restrictedToHref,
        createdAt: u.createdAt.toISOString(),
      }))}
    />
  );
}
