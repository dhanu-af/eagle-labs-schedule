import { prisma } from "@/lib/prisma";
import { getSession, canEdit } from "@/lib/auth";
import { toDateInputValue } from "@/lib/ui";
import KpiClient from "./kpi-client";

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export default async function KpiPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const session = await getSession();
  const baseDate = week ? new Date(`${week}T00:00:00`) : new Date();
  const weekStart = startOfWeek(isNaN(baseDate.getTime()) ? new Date() : baseDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [teams, kpis, tasks, dailyTargets] = await Promise.all([
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    prisma.kpi.findMany({ include: { team: true }, orderBy: { name: "asc" } }),
    prisma.dailyTask.findMany({
      where: { date: { gte: weekStart, lt: weekEnd } },
    }),
    prisma.kpiDailyTarget.findMany({
      where: { date: { gte: weekStart, lt: weekEnd } },
    }),
  ]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <KpiClient
      weekStartStr={toDateInputValue(weekStart)}
      todayStr={toDateInputValue(new Date())}
      teams={teams}
      kpis={kpis.map((k) => ({
        id: k.id,
        teamId: k.teamId,
        teamName: k.team.name,
        product: k.product,
        name: k.name,
        unit: k.unit,
        target: k.target,
      }))}
      dailyByKpi={Object.fromEntries(
        kpis.map((k) => [
          k.id,
          days.map((d) =>
            tasks
              .filter(
                (t) =>
                  t.teamId === k.teamId &&
                  (k.product ? t.product === k.product : true) &&
                  t.date.toDateString() === d.toDateString()
              )
              .reduce((s, t) => s + t.actualQty, 0)
          ),
        ])
      )}
      dailyTargetsByKpi={Object.fromEntries(
        kpis.map((k) => [
          k.id,
          days.map((d) => {
            const override = dailyTargets.find(
              (dt) => dt.kpiId === k.id && dt.date.toDateString() === d.toDateString()
            );
            return override ? override.target : k.target;
          }),
        ])
      )}
      canManage={!!session && canEdit(session.role)}
    />
  );
}
