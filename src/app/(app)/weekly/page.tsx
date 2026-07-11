import { prisma } from "@/lib/prisma";
import { getSession, canEdit } from "@/lib/auth";
import { toDateInputValue } from "@/lib/ui";
import WeeklyPlannerClient from "./weekly-client";

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export default async function WeeklyPlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; team?: string }>;
}) {
  const { week, team } = await searchParams;
  const session = await getSession();

  const baseDate = week ? new Date(`${week}T00:00:00`) : new Date();
  const weekStart = startOfWeek(isNaN(baseDate.getTime()) ? new Date() : baseDate);

  const teams = await prisma.team.findMany({ orderBy: { name: "asc" } });
  const activeTeamId = team && teams.some((t) => t.id === team) ? team : teams[0]?.id ?? "";

  const [employees, assignments] = await Promise.all([
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.weeklyAssignment.findMany({
      where: { weekStart, teamId: activeTeamId },
      include: { employee: true },
    }),
  ]);

  return (
    <WeeklyPlannerClient
      weekStartStr={toDateInputValue(weekStart)}
      teams={teams}
      activeTeamId={activeTeamId}
      employees={employees
        .filter((e) => e.teamId === activeTeamId)
        .map((e) => ({ id: e.id, name: e.name }))}
      assignments={assignments.map((a) => ({
        id: a.id,
        dayOfWeek: a.dayOfWeek,
        employeeId: a.employeeId,
        employeeName: a.employee.name,
        task: a.task,
        hours: a.hours,
      }))}
      canManage={!!session && canEdit(session.role)}
    />
  );
}
