import { redirect } from "next/navigation";
import { getSession, canManageRole, canEdit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PayrollClient from "./payroll-client";

export default async function PayrollPage() {
  const session = await getSession();
  if (!session || !canManageRole(session.role)) redirect("/");

  const payRuns = await prisma.payRun.findMany({
    orderBy: { periodStart: "desc" },
    include: { payslips: { include: { employee: true } } },
    take: 20,
  });

  return (
    <PayrollClient
      canGenerate={canEdit(session.role)}
      payRuns={payRuns.map((p) => ({
        id: p.id,
        periodStart: p.periodStart.toISOString().slice(0, 10),
        periodEnd: p.periodEnd.toISOString().slice(0, 10),
        status: p.status,
        payslips: p.payslips.map((s) => ({
          id: s.id,
          employeeName: s.employee.name,
          regularHours: s.regularHours,
          overtimeHours: s.overtimeHours,
          hourlyRate: s.hourlyRate,
          grossPay: s.grossPay,
        })),
      }))}
    />
  );
}
