import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { todayInBrisbane, toDateInputValueUTC } from "@/lib/ui";
import MyTaskClient from "./my-task-client";

export default async function MyTaskPage() {
  const session = await getSession();
  const today = todayInBrisbane();
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const [employees, tasks, kpis, sops] = await Promise.all([
    prisma.employee.findMany({
      where: { active: true },
      include: { team: true },
      orderBy: { name: "asc" },
    }),
    prisma.dailyTask.findMany({
      where: { date: { gte: today, lt: tomorrow } },
      include: { team: true },
    }),
    prisma.kpi.findMany({ include: { team: true } }),
    prisma.knowledgeEntry.findMany({
      where: { category: "BLENDING_SOP" },
      orderBy: { order: "asc" },
    }),
  ]);

  return (
    <MyTaskClient
      dateStr={toDateInputValueUTC(today)}
      currentEmployeeId={session?.employeeId ?? null}
      employees={employees.map((e) => ({
        id: e.id,
        name: e.name,
        role: e.role,
        teamId: e.teamId,
        teamName: e.team.name,
      }))}
      tasks={tasks.map((t) => ({
        id: t.id,
        employeeId: t.employeeId,
        teamName: t.team.name,
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
      }))}
      kpis={kpis.map((k) => ({
        teamName: k.team.name,
        name: k.name,
        target: k.target,
        unit: k.unit,
      }))}
      sops={sops.map((s) => ({
        id: s.id,
        title: s.title,
        keywords: s.keywords,
        answer: s.answer,
      }))}
    />
  );
}
