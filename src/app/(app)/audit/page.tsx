import { redirect } from "next/navigation";
import { getSession, isAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AuditClient from "./audit-client";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; entityType?: string }>;
}) {
  const session = await getSession();
  if (!session || !isAdminRole(session.role)) redirect("/");

  const { q, entityType } = await searchParams;

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(entityType ? { entityType } : {}),
      ...(q
        ? {
            OR: [
              { summary: { contains: q } },
              { actorName: { contains: q } },
              { action: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const entityTypes = await prisma.auditLog.findMany({
    distinct: ["entityType"],
    select: { entityType: true },
  });

  return (
    <AuditClient
      logs={logs.map((l) => ({
        id: l.id,
        actorName: l.actorName,
        actorRole: l.actorRole,
        action: l.action,
        entityType: l.entityType,
        summary: l.summary,
        createdAt: l.createdAt.toISOString(),
      }))}
      entityTypes={entityTypes.map((e) => e.entityType)}
      currentQuery={q ?? ""}
      currentEntityType={entityType ?? ""}
    />
  );
}
