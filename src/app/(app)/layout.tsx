import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listMyPendingTaskRequests, listTaskRequestRecipients } from "@/lib/actions/task-request-actions";
import AppShell from "@/components/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [notifications, user, myTaskRequests, userOptions] = await Promise.all([
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
    listTaskRequestRecipients(),
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
        link: r.link,
        priority: r.priority,
        status: r.status,
        dueDate: r.dueDate ? r.dueDate.toISOString() : null,
        fromUserName: r.fromUser.fullName,
      }))}
      userOptions={userOptions}
    >
      {children}
    </AppShell>
  );
}
