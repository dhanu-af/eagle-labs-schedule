"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canEdit } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const OVERTIME_MULTIPLIER = 1.5;

async function requireAdmin() {
  const session = await getSession();
  if (!session || !canEdit(session.role)) throw new Error("Not authorized");
  return session;
}

export async function generatePayRun(periodStartStr: string, periodEndStr: string) {
  const session = await requireAdmin();

  const periodStart = new Date(`${periodStartStr}T00:00:00`);
  const periodEnd = new Date(`${periodEndStr}T00:00:00`);
  const periodEndExclusive = new Date(periodEnd);
  periodEndExclusive.setDate(periodEndExclusive.getDate() + 1);

  const employees = await prisma.employee.findMany({ where: { active: true } });
  const attendance = await prisma.attendance.findMany({
    where: { date: { gte: periodStart, lt: periodEndExclusive } },
  });

  const payRun = await prisma.payRun.create({
    data: { periodStart, periodEnd },
  });

  for (const emp of employees) {
    const records = attendance.filter((a) => a.employeeId === emp.id);
    const regularHours = records.reduce((s, r) => s + r.hoursWorked, 0);
    const overtimeHours = records.reduce((s, r) => s + r.overtime, 0);
    const grossPay = regularHours * emp.hourlyRate + overtimeHours * emp.hourlyRate * OVERTIME_MULTIPLIER;

    if (regularHours === 0 && overtimeHours === 0) continue;

    await prisma.payslip.create({
      data: {
        payRunId: payRun.id,
        employeeId: emp.id,
        regularHours,
        overtimeHours,
        hourlyRate: emp.hourlyRate,
        grossPay,
      },
    });
  }

  await logAudit(session, {
    action: "GENERATE_PAY_RUN",
    entityType: "PayRun",
    entityId: payRun.id,
    summary: `Generated pay run for ${periodStartStr} to ${periodEndStr}`,
  });

  revalidatePath("/payroll");
  return payRun.id;
}

export async function finalizePayRun(id: string) {
  const session = await requireAdmin();

  await prisma.payRun.update({
    where: { id },
    data: { status: "FINALIZED", finalizedAt: new Date() },
  });

  await logAudit(session, {
    action: "FINALIZE_PAY_RUN",
    entityType: "PayRun",
    entityId: id,
    summary: `Finalized pay run ${id}`,
  });

  revalidatePath("/payroll");
}

export async function deletePayRun(id: string) {
  const session = await requireAdmin();

  const payRun = await prisma.payRun.findUnique({ where: { id } });
  if (payRun?.status === "FINALIZED") {
    throw new Error("Finalized pay runs cannot be deleted");
  }

  await prisma.payslip.deleteMany({ where: { payRunId: id } });
  await prisma.payRun.delete({ where: { id } });

  await logAudit(session, {
    action: "DELETE_PAY_RUN",
    entityType: "PayRun",
    entityId: id,
    summary: `Deleted draft pay run ${id}`,
  });

  revalidatePath("/payroll");
}
