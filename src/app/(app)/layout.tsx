import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listMyPendingTaskRequests } from "@/lib/actions/task-request-actions";
import AppShell from "@/components/app-shell";

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  SUPERVISOR: "Supervisor",
  OPERATIONS: "Operations",
  TEAM_LEAD: "Team Lead",
  QA: "QA",
  EMPLOYEE: "Employee",
  OTHERS: "Others",
  EXTRA: "Extra",
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [notifications, user, myTaskRequests, users] = await Promise.all([
    session.employeeId
      ? prisma.notification.findMany({
          where: { employeeId: session.employeeId },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
    prisma.user.findUnique({ where: { id: session.userId }, select: { ingredientLibraryAccess: true, restrictedToHref: true } }),
    // Global (not Dashboard-only) so every logged-in person gets it regardless of
    // nav restrictions -- EXTRA's staging-only nav and OTHERS' single-restricted-
    // page nav never route through "/", but both still render this shared layout.
    listMyPendingTaskRequests(),
    // Keyed on User, not Employee -- real data showed almost no login is linked
    // to an Employee record, so an Employee-based picker couldn't actually reach
    // most real accounts.
    prisma.user.findMany({ where: { disabled: false, id: { not: session.userId } }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true, role: true } }),
  ]);

  return (
    <AppShell
      user={{
        name: session.fullName,
        role: session.role,
        ingredientLibraryAccess: user?.ingredientLibraryAccess ?? false,
        restrictedToHref: user?.restrictedToHref ?? null,
      }}
      notifications={notifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        link: n.link,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      }))}
      taskRequests={myTaskRequests.map((r) => ({
        id: r.id,
        title: r.title,
        message: r.message,
        priority: r.priority,
        status: r.status,
        dueDate: r.dueDate ? r.dueDate.toISOString() : null,
        fromUserName: r.fromUser.fullName,
      }))}
      userOptions={users.map((u) => ({ id: u.id, fullName: u.fullName, roleLabel: ROLE_LABELS[u.role] ?? u.role }))}
    >
      {children}
    </AppShell>
  );
}
