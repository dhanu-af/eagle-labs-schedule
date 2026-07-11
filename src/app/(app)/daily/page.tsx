import { prisma } from "@/lib/prisma";
import { getSession, canEdit } from "@/lib/auth";
import { toDateInputValue } from "@/lib/ui";
import DailyPlannerClient from "./daily-client";

function parseDate(input?: string) {
  if (input) {
    const d = new Date(`${input}T00:00:00`);
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function DailyPlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const session = await getSession();
  const date = parseDate(dateParam);
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  const [teams, employees, tasks] = await Promise.all([
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.dailyTask.findMany({
      where: { date: { gte: date, lt: nextDay } },
      include: { employee: true, team: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <DailyPlannerClient
      dateStr={toDateInputValue(date)}
      teams={teams}
      employees={employees.map((e) => ({ id: e.id, name: e.name, teamId: e.teamId }))}
      tasks={tasks.map((t) => ({
        id: t.id,
        teamId: t.teamId,
        teamName: t.team.name,
        employeeId: t.employeeId,
        employeeName: t.employee?.name ?? null,
        product: t.product,
        batchNo: t.batchNo,
        process: t.process,
        targetQty: t.targetQty,
        targetUnit: t.targetUnit,
        actualQty: t.actualQty,
        plannedStart: t.plannedStart,
        plannedFinish: t.plannedFinish,
        priority: t.priority,
        status: t.status,
        delayReason: t.delayReason,
        notes: t.notes,
      }))}
      canManage={!!session && canEdit(session.role)}
    />
  );
}
