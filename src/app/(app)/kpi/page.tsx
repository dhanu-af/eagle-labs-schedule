import { prisma } from "@/lib/prisma";
import { getSession, canEdit, canEditKpiProduction, canEditMachineSpeed } from "@/lib/auth";
import { toDateInputValueUTC, todayInBrisbane } from "@/lib/ui";
import KpiClient from "./kpi-client";

function startOfWeek(d: Date) {
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

const WEEKS_COUNT = 8;
const MONTHS_COUNT = 6;

export default async function KpiPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const session = await getSession();
  const baseDate = week ? new Date(`${week}T00:00:00Z`) : todayInBrisbane();
  const weekStart = startOfWeek(isNaN(baseDate.getTime()) ? todayInBrisbane() : baseDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const today = todayInBrisbane();
  const currentWeekStart = startOfWeek(today);
  const weeklyRangeStart = new Date(currentWeekStart);
  weeklyRangeStart.setUTCDate(weeklyRangeStart.getUTCDate() - (WEEKS_COUNT - 1) * 7);

  const currentMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const monthlyRangeStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (MONTHS_COUNT - 1), 1));
  const monthlyRangeEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));

  // The 6-month window always encloses the 8-week window, so one broad fetch covers both summaries.
  const historyStart = monthlyRangeStart < weeklyRangeStart ? monthlyRangeStart : weeklyRangeStart;
  const historyEnd = monthlyRangeEnd;

  const [teams, kpis, tasks, dailyTargets, historyTasks, historyTargets, dailyProduction] = await Promise.all([
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    prisma.kpi.findMany({ include: { team: true }, orderBy: { name: "asc" } }),
    prisma.dailyTask.findMany({
      where: { date: { gte: weekStart, lt: weekEnd } },
    }),
    prisma.kpiDailyTarget.findMany({
      where: { date: { gte: weekStart, lt: weekEnd } },
    }),
    prisma.dailyTask.findMany({
      where: { date: { gte: historyStart, lt: historyEnd } },
    }),
    prisma.kpiDailyTarget.findMany({
      where: { date: { gte: historyStart, lt: historyEnd } },
    }),
    prisma.kpiDailyProduction.findMany({
      where: { date: { gte: weekStart, lt: weekEnd } },
    }),
  ]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + i);
    return d;
  });

  function actualFor(kpi: (typeof kpis)[number], date: Date, source: typeof historyTasks) {
    return source
      .filter(
        (t) =>
          t.teamId === kpi.teamId &&
          (kpi.product ? t.product === kpi.product : true) &&
          t.date.toDateString() === date.toDateString()
      )
      .reduce((s, t) => s + t.actualQty, 0);
  }

  function targetFor(kpi: (typeof kpis)[number], date: Date, source: typeof historyTargets) {
    const override = source.find((dt) => dt.kpiId === kpi.id && dt.date.toDateString() === date.toDateString());
    return override ? override.target : kpi.target;
  }

  const WEEK_LABELS: string[] = [];
  const weeklyByKpi: Record<string, { actual: number[]; target: number[] }> = {};
  for (const k of kpis) weeklyByKpi[k.id] = { actual: Array(WEEKS_COUNT).fill(0), target: Array(WEEKS_COUNT).fill(0) };

  for (let w = 0; w < WEEKS_COUNT; w++) {
    const bucketStart = new Date(weeklyRangeStart);
    bucketStart.setUTCDate(bucketStart.getUTCDate() + w * 7);
    const bucketEnd = new Date(bucketStart);
    bucketEnd.setUTCDate(bucketEnd.getUTCDate() + 6);
    WEEK_LABELS.push(
      `${bucketStart.toLocaleDateString("en-AU", { day: "2-digit", month: "short" })}`
    );
    for (const k of kpis) {
      let actualSum = 0;
      let targetSum = 0;
      for (let d = 0; d < 7; d++) {
        const day = new Date(bucketStart);
        day.setUTCDate(day.getUTCDate() + d);
        actualSum += actualFor(k, day, historyTasks);
        targetSum += targetFor(k, day, historyTargets);
      }
      weeklyByKpi[k.id].actual[w] = actualSum;
      weeklyByKpi[k.id].target[w] = targetSum;
    }
  }

  const MONTH_LABELS: string[] = [];
  const monthlyByKpi: Record<string, { actual: number[]; target: number[] }> = {};
  for (const k of kpis) monthlyByKpi[k.id] = { actual: Array(MONTHS_COUNT).fill(0), target: Array(MONTHS_COUNT).fill(0) };

  for (let m = 0; m < MONTHS_COUNT; m++) {
    const monthStart = new Date(Date.UTC(monthlyRangeStart.getUTCFullYear(), monthlyRangeStart.getUTCMonth() + m, 1));
    const monthEnd = new Date(Date.UTC(monthlyRangeStart.getUTCFullYear(), monthlyRangeStart.getUTCMonth() + m + 1, 1));
    const daysInMonth = Math.round((monthEnd.getTime() - monthStart.getTime()) / 86400000);
    MONTH_LABELS.push(monthStart.toLocaleDateString("en-AU", { month: "short", year: "2-digit" }));
    for (const k of kpis) {
      let actualSum = 0;
      let targetSum = 0;
      for (let d = 0; d < daysInMonth; d++) {
        const day = new Date(monthStart);
        day.setUTCDate(day.getUTCDate() + d);
        actualSum += actualFor(k, day, historyTasks);
        targetSum += targetFor(k, day, historyTargets);
      }
      monthlyByKpi[k.id].actual[m] = actualSum;
      monthlyByKpi[k.id].target[m] = targetSum;
    }
  }

  const currentWeekIndex = WEEKS_COUNT - 1;
  const currentMonthIndex = MONTHS_COUNT - 1;

  const productionByKpi = Object.fromEntries(
    kpis.map((k) => [
      k.id,
      days.map((d) => {
        const entry = dailyProduction.find(
          (p) => p.kpiId === k.id && p.date.toDateString() === d.toDateString()
        );
        if (!entry) return null;
        return {
          fillWeightMg: entry.fillWeightMg,
          capsulesPerBottle: entry.capsulesPerBottle,
          productionTimeHours: entry.productionTimeHours,
          plannedBatchSizeKg: entry.plannedBatchSizeKg,
          totalInputWeightKg: entry.totalInputWeightKg,
          machineSpeedHz: entry.machineSpeedHz,
        };
      }),
    ])
  );

  return (
    <KpiClient
      weekStartStr={toDateInputValueUTC(weekStart)}
      todayStr={toDateInputValueUTC(todayInBrisbane())}
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
      weekLabels={WEEK_LABELS}
      weeklyByKpi={weeklyByKpi}
      currentWeekIndex={currentWeekIndex}
      monthLabels={MONTH_LABELS}
      monthlyByKpi={monthlyByKpi}
      currentMonthIndex={currentMonthIndex}
      canManage={!!session && canEdit(session.role)}
      productionByKpi={productionByKpi}
      canEditProduction={!!session && canEditKpiProduction(session.role)}
      canEditMachineSpeed={!!session && canEditMachineSpeed(session.role)}
    />
  );
}
