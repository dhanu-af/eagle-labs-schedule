import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const notifications = session.employeeId
    ? await prisma.notification.findMany({
        where: { employeeId: session.employeeId },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  return (
    <AppShell
      user={{ name: session.fullName, role: session.role }}
      notifications={notifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        link: n.link,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      }))}
    >
      {children}
    </AppShell>
  );
}
