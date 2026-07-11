import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  getSession,
  canActAsSupervisor,
  canActAsQa,
  canActAsOperator,
  canUnlockChecks,
} from "@/lib/auth";
import ChecksClient from "./checks-client";

function iso(d: Date | null) {
  return d ? d.toISOString() : null;
}

export default async function ChecksPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [supervisorPreOp, qaPreOp, environmental, envLimits, lineClearance, postOp] =
    await Promise.all([
      prisma.supervisorPreOpCheck.findMany({ orderBy: { date: "desc" }, take: 100 }),
      prisma.qaPreOpCheck.findMany({ orderBy: { date: "desc" }, take: 100 }),
      prisma.environmentalCheck.findMany({ orderBy: { date: "desc" }, take: 200 }),
      prisma.environmentalLimit.findMany(),
      prisma.lineClearance.findMany({ orderBy: { date: "desc" }, take: 100 }),
      prisma.postOpCheck.findMany({ orderBy: { date: "desc" }, take: 100 }),
    ]);

  return (
    <ChecksClient
      permissions={{
        canSupervisor: canActAsSupervisor(session.role),
        canQa: canActAsQa(session.role),
        canOperator: canActAsOperator(session.role),
        canUnlock: canUnlockChecks(session.role),
      }}
      supervisorPreOp={supervisorPreOp.map((r) => ({
        ...r,
        date: r.date.toISOString(),
        submittedAt: r.submittedAt.toISOString(),
      }))}
      qaPreOp={qaPreOp.map((r) => ({
        ...r,
        date: r.date.toISOString(),
        submittedAt: r.submittedAt.toISOString(),
      }))}
      environmental={environmental.map((r) => ({
        ...r,
        date: r.date.toISOString(),
        submittedAt: r.submittedAt.toISOString(),
        supervisorApprovedAt: iso(r.supervisorApprovedAt),
        qaApprovedAt: iso(r.qaApprovedAt),
      }))}
      envLimits={envLimits}
      lineClearance={lineClearance.map((r) => ({
        ...r,
        date: r.date.toISOString(),
        submittedAt: r.submittedAt.toISOString(),
        supervisorApprovedAt: iso(r.supervisorApprovedAt),
        qaApprovedAt: iso(r.qaApprovedAt),
      }))}
      postOp={postOp.map((r) => ({
        ...r,
        date: r.date.toISOString(),
        submittedAt: r.submittedAt.toISOString(),
        verifiedAt: iso(r.verifiedAt),
      }))}
    />
  );
}
