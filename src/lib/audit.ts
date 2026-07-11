import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";

export async function logAudit(
  session: SessionPayload,
  params: {
    action: string;
    entityType: string;
    entityId?: string;
    summary: string;
  }
) {
  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      actorName: session.fullName,
      actorRole: session.role,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      summary: params.summary,
    },
  });
}
