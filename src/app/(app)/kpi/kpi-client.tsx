"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createKpi, deleteKpi, setDailyTarget, setKpiDailyProduction, updateKpi } from "@/lib/actions/kpi-actions";
import { getTaskActivity } from "@/lib/actions/daily-actions";
import { pct, toDateInputValue, formatBrisbaneDateTime } from "@/lib/ui";
import { DEFAULT_FILL_WEIGHT_MG, DEFAULT_CAPSULES_PER_BOTTLE, CAPSULES_PER_HOUR_PER_HZ } from "@/lib/kpi-defaults";
import KpiChart from "./kpi-chart";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

type Team = { id: string; name: string };
type Kpi = {
  id: string;
  teamId: string;
  teamName: string;
  product: string | null;
  name: string;
  unit: string;
  target: number;
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type PeriodSeries = Record<string, { actual: number[]; target: number[] }>;

type ProductionEntry = {
  fillWeightMg: number | null;
  capsulesPerBottle: number | null;
  productionTimeHours: number | null;
  plannedBatchSizeKg: number | null;
  totalInputWeightKg: number | null;
  machineSpeedHz: number | null;
};

type TaskActivityEntry = {
  id: string;
  action: string;
  summary: string;
  actorName: string;
  createdAt: string;
  status: string | null;
};

const ACTIVITY_LABELS: Record<string, string> = {
  CREATE_TASK: "Task created",
  UPDATE_TASK_STATUS: "Status / weight update",
  UPDATE_TASK: "Task updated",
  DELETE_TASK: "Task deleted",
  DUPLICATE_DAY: "Duplicated from previous day",
};

/** First RUNNING → last COMPLETED, minus any time spent DELAYED or OTHER in between — only actual Running time counts. */
function computeNetWorkingHours(activity: TaskActivityEntry[]): number | null {
  const statusEvents = activity.filter((a) => a.status).map((a) => ({ status: a.status!, at: new Date(a.createdAt).getTime() }));
  const startedAt = statusEvents.find((e) => e.status === "RUNNING")?.at;
  const completedEvents = statusEvents.filter((e) => e.status === "COMPLETED");
  const completedAt = completedEvents.length > 0 ? completedEvents[completedEvents.length - 1].at : undefined;
  if (!startedAt || !completedAt || completedAt <= startedAt) return null;

  let excludedMs = 0;
  let excludeStart: number | null = null;
  for (const e of statusEvents) {
    if (e.at < startedAt || e.at > completedAt) continue;
    if (e.status === "DELAYED" || e.status === "OTHER") {
      if (excludeStart === null) excludeStart = e.at;
    } else if (excludeStart !== null) {
      excludedMs += e.at - excludeStart;
      excludeStart = null;
    }
  }

  const netMs = completedAt - startedAt - excludedMs;
  return netMs > 0 ? Math.round((netMs / 3_600_000) * 100) / 100 : null;
}

export default function KpiClient({
  weekStartStr,
  todayStr,
  teams,
  kpis,
  dailyByKpi,
  dailyTargetsByKpi,
  weekLabels,
  weeklyByKpi,
  currentWeekIndex,
  monthLabels,
  monthlyByKpi,
  currentMonthIndex,
  canManage,
  productionByKpi,
  canEditProduction,
  canEditMachineSpeed,
}: {
  weekStartStr: string;
  todayStr: string;
  teams: Team[];
  kpis: Kpi[];
  dailyByKpi: Record<string, number[]>;
  dailyTargetsByKpi: Record<string, number[]>;
  weekLabels: string[];
  weeklyByKpi: PeriodSeries;
  currentWeekIndex: number;
  monthLabels: string[];
  monthlyByKpi: PeriodSeries;
  currentMonthIndex: number;
  canManage: boolean;
  productionByKpi: Record<string, (ProductionEntry | null)[]>;
  canEditProduction: boolean;
  canEditMachineSpeed: boolean;
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [editKpi, setEditKpi] = useState<Kpi | null>(null);
  const [pending, startTransition] = useTransition();

  const weekStartDate = new Date(`${weekStartStr}T00:00:00`);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 6);

  function goWeek(offset: number) {
    const d = new Date(weekStartDate);
    d.setDate(d.getDate() + offset * 7);
    router.push(`/kpi?week=${toDateInputValue(d)}`);
  }

  function remove(id: string) {
    if (!confirm("Delete this KPI and all its recorded history? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteKpi(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="KPI Tracking"
        subtitle={
          <>
            Target vs actual, daily and weekly completion.
            <br />
            {weekStartDate.toLocaleDateString("en-AU", { day: "2-digit", month: "short" })} –{" "}
            {weekEndDate.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}
          </>
        }
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => goWeek(-1)}>
              ← Prev week
            </Button>
            <Button variant="secondary" size="sm" onClick={() => goWeek(1)}>
              Next week →
            </Button>
            {canManage && <Button onClick={() => setShowAdd(true)}>+ New KPI</Button>}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {kpis.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-surface lg:col-span-2">
            <EmptyState title="No KPIs defined yet." description={canManage ? "Click “+ New KPI” to add one." : undefined} />
          </div>
        )}
        {kpis.map((k) => {
          const dailyActuals = dailyByKpi[k.id] ?? [0, 0, 0, 0, 0, 0, 0];
          const dailyTargets = dailyTargetsByKpi[k.id] ?? Array(7).fill(k.target);
          const weeklyActual = dailyActuals.reduce((s, v) => s + v, 0);
          const weeklyTarget = dailyTargets.reduce((s, v) => s + v, 0);
          const weeklyPct = pct(weeklyActual, weeklyTarget);
          const todayIndex = Math.round(
            (new Date(`${todayStr}T00:00:00`).getTime() - weekStartDate.getTime()) / 86400000
          );

          const chartData = dailyActuals.map((actual, i) => ({
            day: DAY_LABELS[i],
            actual,
            target: dailyTargets[i],
            isToday: i === todayIndex,
          }));
          const chartColor = weeklyPct >= 100 ? "#4ade80" : weeklyPct >= 50 ? "#34d399" : "#e0aa4e";

          return (
            <Card interactive key={k.id}>
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {k.teamName} · {k.name}
                    {k.product && (
                      <span className="ml-1.5 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        {k.product}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">Base daily target {k.target} {k.unit} (editable per day below)</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="text-right">
                    <p className="text-lg font-semibold tabular-nums text-foreground">{weeklyPct}%</p>
                    <p className="text-xs text-muted-foreground">
                      {weeklyActual}/{weeklyTarget} {k.unit} wk
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex flex-col gap-1 text-xs">
                      <button onClick={() => setEditKpi(k)} className="font-medium text-muted-foreground transition-colors duration-150 ease-out hover:text-primary">
                        Edit
                      </button>
                      <button onClick={() => remove(k.id)} className="font-medium text-muted-foreground transition-colors duration-150 ease-out hover:text-danger">
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <KpiChart data={chartData} unit={k.unit} color={chartColor} />

              <DailyTargetsRow
                kpiId={k.id}
                teamId={k.teamId}
                product={k.product}
                weekStartStr={weekStartStr}
                targets={dailyTargets}
                actuals={dailyActuals}
                unit={k.unit}
                canManage={canManage}
                production={productionByKpi[k.id] ?? Array(7).fill(null)}
                canEditProduction={canEditProduction}
                canEditMachineSpeed={canEditMachineSpeed}
                isEncapsulation={k.teamName.toLowerCase().includes("encapsulation")}
                isBlending={k.teamName.toLowerCase().includes("blending")}
              />

              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs">
                <span className="text-muted-foreground">
                  Actuals are synced automatically from the Daily Planner.
                </span>
                <Link href={`/daily?date=${todayStr}`} className="font-medium text-primary hover:underline">
                  Update in Daily Planner →
                </Link>
              </div>
            </Card>
          );
        })}
      </div>

      {kpis.length > 0 && (
        <>
          <PeriodSection
            title="Weekly KPI"
            subtitle={`Actual vs target by week — last ${weekLabels.length} weeks`}
            kpis={kpis}
            labels={weekLabels}
            byKpi={weeklyByKpi}
            currentIndex={currentWeekIndex}
          />
          <PeriodSection
            title="Monthly KPI"
            subtitle={`Actual vs target by month — last ${monthLabels.length} months`}
            kpis={kpis}
            labels={monthLabels}
            byKpi={monthlyByKpi}
            currentIndex={currentMonthIndex}
          />
        </>
      )}

      {showAdd && <KpiFormModal teams={teams} onClose={() => setShowAdd(false)} />}
      {editKpi && (
        <KpiFormModal teams={teams} existing={editKpi} onClose={() => setEditKpi(null)} />
      )}
    </div>
  );
}

function PeriodSection({
  title,
  subtitle,
  kpis,
  labels,
  byKpi,
  currentIndex,
}: {
  title: string;
  subtitle: string;
  kpis: Kpi[];
  labels: string[];
  byKpi: PeriodSeries;
  currentIndex: number;
}) {
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {kpis.map((k) => {
          const series = byKpi[k.id] ?? { actual: [], target: [] };
          const totalActual = series.actual.reduce((s, v) => s + v, 0);
          const totalTarget = series.target.reduce((s, v) => s + v, 0);
          const totalPct = pct(totalActual, totalTarget);
          const chartColor = totalPct >= 100 ? "#4ade80" : totalPct >= 50 ? "#34d399" : "#e0aa4e";
          const chartData = series.actual.map((actual, i) => ({
            day: labels[i] ?? "",
            actual,
            target: series.target[i] ?? 0,
            isToday: i === currentIndex,
          }));

          return (
            <Card key={k.id}>
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {k.teamName} · {k.name}
                    {k.product && (
                      <span className="ml-1.5 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        {k.product}
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold tabular-nums text-foreground">{totalPct}%</p>
                  <p className="text-xs text-muted-foreground">
                    {totalActual}/{totalTarget} {k.unit}
                  </p>
                </div>
              </div>
              <KpiChart data={chartData} unit={k.unit} color={chartColor} />
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function DailyTargetsRow({
  kpiId,
  teamId,
  product,
  weekStartStr,
  targets,
  actuals,
  unit,
  canManage,
  production,
  canEditProduction,
  canEditMachineSpeed,
  isEncapsulation,
  isBlending,
}: {
  kpiId: string;
  teamId: string;
  product: string | null;
  weekStartStr: string;
  targets: number[];
  actuals: number[];
  unit: string;
  canManage: boolean;
  production: (ProductionEntry | null)[];
  canEditProduction: boolean;
  canEditMachineSpeed: boolean;
  isEncapsulation: boolean;
  isBlending: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState(targets);
  const [dirtyDays, setDirtyDays] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [openDay, setOpenDay] = useState<number | null>(null);

  useEffect(() => {
    setValues(targets);
    setDirtyDays(new Set());
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartStr, kpiId]);

  function dateForDay(i: number) {
    const d = new Date(`${weekStartStr}T00:00:00`);
    d.setDate(d.getDate() + i);
    return toDateInputValue(d);
  }

  function save() {
    const days = Array.from(dirtyDays);
    setError("");
    startTransition(async () => {
      try {
        await Promise.all(days.map((i) => setDailyTarget(kpiId, dateForDay(i), values[i])));
        setDirtyDays(new Set());
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save the daily target.");
      }
    });
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
        Daily targets ({unit})
      </p>
      <div className="grid grid-cols-7 gap-1">
        {DAY_LABELS.map((label, i) => {
          const d = new Date(`${weekStartStr}T00:00:00`);
          d.setDate(d.getDate() + i);
          const actual = actuals[i] ?? 0;
          const met = values[i] > 0 && actual >= values[i];
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-[9px] text-muted-foreground">
                {label} - {d.getDate()}
              </span>
              {canManage ? (
                <input
                  type="number"
                  value={values[i]}
                  onChange={(e) => {
                    const next = [...values];
                    next[i] = Number(e.target.value);
                    setValues(next);
                    setDirtyDays((prev) => new Set(prev).add(i));
                  }}
                  className="w-full rounded-md border border-border bg-surface px-1 py-1 text-center text-[10px] text-foreground"
                />
              ) : (
                <span className="text-[10px] text-foreground">{values[i]}</span>
              )}
              <span className={`text-[9px] font-medium tabular-nums ${met ? "text-success" : "text-foreground"}`}>
                {actual} done
              </span>
              <button
                onClick={() => setOpenDay(i)}
                className={`text-[9px] font-medium underline decoration-dotted underline-offset-2 transition-colors duration-150 ease-out hover:text-primary ${
                  production[i] ? "text-primary" : "text-muted-foreground"
                }`}
              >
                Details
              </button>
            </div>
          );
        })}
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      {dirtyDays.size > 0 && (
        <Button size="sm" className="mt-2 w-full" onClick={save} disabled={pending}>
          {pending ? "Saving..." : "Save daily targets"}
        </Button>
      )}
      {openDay !== null && (
        <ProductionDetailsModal
          kpiId={kpiId}
          teamId={teamId}
          product={product}
          dateStr={dateForDay(openDay)}
          dayLabel={`${DAY_LABELS[openDay]} - ${new Date(dateForDay(openDay) + "T00:00:00").getDate()}`}
          unit={unit}
          actual={actuals[openDay] ?? 0}
          existing={production[openDay]}
          canEdit={canEditProduction}
          canEditMachineSpeed={canEditMachineSpeed}
          isEncapsulation={isEncapsulation}
          isBlending={isBlending}
          onClose={() => setOpenDay(null)}
        />
      )}
    </div>
  );
}

function ProductionDetailsModal({
  kpiId,
  teamId,
  product,
  dateStr,
  dayLabel,
  unit,
  actual,
  existing,
  canEdit,
  canEditMachineSpeed,
  isEncapsulation,
  isBlending,
  onClose,
}: {
  kpiId: string;
  teamId: string;
  product: string | null;
  dateStr: string;
  dayLabel: string;
  unit: string;
  actual: number;
  existing: ProductionEntry | null;
  canEdit: boolean;
  canEditMachineSpeed: boolean;
  isEncapsulation: boolean;
  isBlending: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [fillWeightMg, setFillWeightMg] = useState<number | "">(existing?.fillWeightMg ?? DEFAULT_FILL_WEIGHT_MG);
  const [capsulesPerBottle, setCapsulesPerBottle] = useState<number | "">(existing?.capsulesPerBottle ?? DEFAULT_CAPSULES_PER_BOTTLE);
  const [productionTimeHours, setProductionTimeHours] = useState<number | "">(existing?.productionTimeHours ?? "");
  const [plannedBatchSizeKg, setPlannedBatchSizeKg] = useState<number | "">(existing?.plannedBatchSizeKg ?? "");
  const [totalInputWeightKg, setTotalInputWeightKg] = useState<number | "">(existing?.totalInputWeightKg ?? "");
  const [machineSpeedHz, setMachineSpeedHz] = useState<number | "">(existing?.machineSpeedHz ?? "");
  const [activity, setActivity] = useState<TaskActivityEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTaskActivity(teamId, product, dateStr).then((entries) => {
      if (cancelled) return;
      setActivity(entries);
      const netHours = computeNetWorkingHours(entries);
      if (netHours !== null) setProductionTimeHours(netHours);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, product, dateStr]);

  const fillWeight = Number(fillWeightMg) || null;
  const perBottle = Number(capsulesPerBottle) || null;
  const timeHours = Number(productionTimeHours) || null;

  const totalCapsules = actual && fillWeight ? Math.round((actual * 1_000_000) / fillWeight) : null;
  const totalBottles = totalCapsules && perBottle ? Math.floor(totalCapsules / perBottle) : null;
  const productionRate = totalCapsules && timeHours ? Math.round(totalCapsules / timeHours) : null;

  const machineSpeed = Number(machineSpeedHz) || null;
  const theoreticalCapsules = machineSpeed && timeHours ? Math.round(machineSpeed * CAPSULES_PER_HOUR_PER_HZ * timeHours) : null;

  const inputWeight = Number(totalInputWeightKg) || null;
  const plannedSize = Number(plannedBatchSizeKg) || null;
  const materialLoss = inputWeight !== null ? inputWeight - actual : null;
  const yieldPct = inputWeight ? (actual / inputWeight) * 100 : null;
  const blendingRate = timeHours && actual ? actual / timeHours : null;

  function save() {
    setError("");
    startTransition(async () => {
      try {
        await setKpiDailyProduction(kpiId, dateStr, {
          fillWeightMg: isEncapsulation ? fillWeight : null,
          capsulesPerBottle: isEncapsulation ? perBottle : null,
          productionTimeHours: timeHours,
          plannedBatchSizeKg: isBlending ? plannedSize : null,
          totalInputWeightKg: isBlending ? inputWeight : null,
          machineSpeedHz: isEncapsulation ? machineSpeed : null,
        });
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save production details.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{dayLabel} — Production Details</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>

        {isEncapsulation && (canEdit ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-surface-muted/40 px-3 py-2 text-xs">
              <DetailLine label="Total Batch Weight" value={`${actual} ${unit}`} />
              <p className="mt-1 text-[10px] text-muted-foreground">Follows the day's actual production automatically.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Average Fill Weight (mg/capsule)</span>
                <input
                  type="number"
                  step="0.01"
                  value={fillWeightMg}
                  onChange={(e) => setFillWeightMg(e.target.value === "" ? "" : Number(e.target.value))}
                  className="input"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Capsules per Bottle</span>
                <input
                  type="number"
                  step="1"
                  value={capsulesPerBottle}
                  onChange={(e) => setCapsulesPerBottle(e.target.value === "" ? "" : Number(e.target.value))}
                  className="input"
                />
              </label>
              <label className="col-span-2 block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Average Production Time (hours)</span>
                <input
                  type="number"
                  step="0.1"
                  value={productionTimeHours}
                  onChange={(e) => setProductionTimeHours(e.target.value === "" ? "" : Number(e.target.value))}
                  className="input"
                />
                <span className="mt-1 block text-[10px] text-muted-foreground">
                  Auto-calculated from the activity log (first Running to last Completed, minus any Delayed time) — editable.
                </span>
              </label>
              <label className="col-span-2 block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Machine Speed (Hz)</span>
                {canEditMachineSpeed ? (
                  <input
                    type="number"
                    step="0.1"
                    value={machineSpeedHz}
                    onChange={(e) => setMachineSpeedHz(e.target.value === "" ? "" : Number(e.target.value))}
                    className="input"
                  />
                ) : (
                  <p className="input flex items-center text-muted-foreground">{machineSpeed !== null ? `${machineSpeed} Hz` : "—"}</p>
                )}
                <span className="mt-1 block text-[10px] text-muted-foreground">
                  {canEditMachineSpeed ? "Editable by Super Admin only." : "Super Admin only — contact one to update."}
                </span>
              </label>
            </div>

            <div className="rounded-lg border border-border bg-surface-muted/40 p-3 text-xs">
              <DetailLine label="Total Capsules" value={totalCapsules !== null ? `${totalCapsules.toLocaleString()} capsules` : "—"} />
              <DetailLine
                label="Total Bottle Quantity"
                value={
                  totalBottles !== null
                    ? `${totalBottles.toLocaleString()} bottles${perBottle ? ` (${perBottle} capsules/bottle)` : ""}`
                    : "—"
                }
              />
              <DetailLine label="Average Production Rate" value={productionRate !== null ? `${productionRate.toLocaleString()} capsules/hour` : "—"} />
              <DetailLine label="Theoretical Capsules" value={theoreticalCapsules !== null ? `${theoreticalCapsules.toLocaleString()} capsules` : "—"} />
            </div>

            {error && <p className="text-xs text-danger">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={save} disabled={pending}>
                {pending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        ) : existing ? (
          <div className="rounded-lg border border-border bg-surface-muted/40 p-3 text-xs">
            <DetailLine label="Total Batch Weight" value={`${actual} ${unit}`} />
            <DetailLine label="Average Fill Weight" value={fillWeight !== null ? `${fillWeight} mg/capsule` : "—"} />
            <DetailLine label="Total Capsules" value={totalCapsules !== null ? `${totalCapsules.toLocaleString()} capsules` : "—"} />
            <DetailLine
              label="Total Bottle Quantity"
              value={
                totalBottles !== null
                  ? `${totalBottles.toLocaleString()} bottles${perBottle ? ` (${perBottle} capsules/bottle)` : ""}`
                  : "—"
              }
            />
            <DetailLine label="Average Production Time" value={timeHours !== null ? `${timeHours} hours` : "—"} />
            <DetailLine label="Average Production Rate" value={productionRate !== null ? `${productionRate.toLocaleString()} capsules/hour` : "—"} />
            <DetailLine label="Machine Speed" value={machineSpeed !== null ? `${machineSpeed} Hz` : "—"} />
            <DetailLine label="Theoretical Capsules" value={theoreticalCapsules !== null ? `${theoreticalCapsules.toLocaleString()} capsules` : "—"} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No production details recorded for this day yet.</p>
        ))}

        {isBlending && (canEdit ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
              End of Blending Performance
            </p>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Planned Batch Size (kg)</span>
                <input
                  type="number"
                  step="0.01"
                  value={plannedBatchSizeKg}
                  onChange={(e) => setPlannedBatchSizeKg(e.target.value === "" ? "" : Number(e.target.value))}
                  className="input"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Total Input Weight (kg)</span>
                <input
                  type="number"
                  step="0.01"
                  value={totalInputWeightKg}
                  onChange={(e) => setTotalInputWeightKg(e.target.value === "" ? "" : Number(e.target.value))}
                  className="input"
                />
              </label>
              <label className="col-span-2 block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Blending Duration (hours)</span>
                <input
                  type="number"
                  step="0.1"
                  value={productionTimeHours}
                  onChange={(e) => setProductionTimeHours(e.target.value === "" ? "" : Number(e.target.value))}
                  className="input"
                />
                <span className="mt-1 block text-[10px] text-muted-foreground">
                  Auto-calculated from the activity log (first Running to last Completed, minus any Delayed time) — editable.
                </span>
              </label>
            </div>

            <div className="rounded-lg border border-border bg-surface-muted/40 p-3 text-xs">
              <DetailLine label="Planned Batch Size" value={plannedSize !== null ? `${plannedSize} kg` : "—"} />
              <DetailLine label="Total Input Weight" value={inputWeight !== null ? `${inputWeight} kg` : "—"} />
              <DetailLine label="Final Batch Weight" value={`${actual} ${unit}`} />
              <DetailLine label="Material Loss" value={materialLoss !== null ? `${materialLoss.toFixed(2)} kg` : "—"} />
              <DetailLine label="Yield" value={yieldPct !== null ? `${yieldPct.toFixed(2)}%` : "—"} />
              <DetailLine label="Blending Duration" value={timeHours !== null ? `${timeHours} hours` : "—"} />
              <DetailLine label="Production Rate" value={blendingRate !== null ? `${blendingRate.toFixed(2)} kg/hour` : "—"} />
            </div>

            {error && <p className="text-xs text-danger">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={save} disabled={pending}>
                {pending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        ) : existing ? (
          <div className="rounded-lg border border-border bg-surface-muted/40 p-3 text-xs">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
              End of Blending Performance
            </p>
            <DetailLine label="Planned Batch Size" value={plannedSize !== null ? `${plannedSize} kg` : "—"} />
            <DetailLine label="Total Input Weight" value={inputWeight !== null ? `${inputWeight} kg` : "—"} />
            <DetailLine label="Final Batch Weight" value={`${actual} ${unit}`} />
            <DetailLine label="Material Loss" value={materialLoss !== null ? `${materialLoss.toFixed(2)} kg` : "—"} />
            <DetailLine label="Yield" value={yieldPct !== null ? `${yieldPct.toFixed(2)}%` : "—"} />
            <DetailLine label="Blending Duration" value={timeHours !== null ? `${timeHours} hours` : "—"} />
            <DetailLine label="Production Rate" value={blendingRate !== null ? `${blendingRate.toFixed(2)} kg/hour` : "—"} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No production details recorded for this day yet.</p>
        ))}

        <div className={isEncapsulation || isBlending ? "mt-4 border-t border-border pt-3" : ""}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
            Activity History
          </p>
          {activity === null ? (
            <p className="text-xs text-muted-foreground">Loading...</p>
          ) : activity.length === 0 ? (
            <p className="text-xs text-muted-foreground">No task activity recorded for this day.</p>
          ) : (
            <div className="space-y-2">
              {activity.map((a) => (
                <div key={a.id} className="rounded-lg border border-border bg-surface-muted/40 px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{ACTIVITY_LABELS[a.action] ?? a.action}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{formatBrisbaneDateTime(a.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-muted-foreground">
                    {a.summary} · <span className="font-medium text-foreground">{a.actorName}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 first:pt-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function KpiFormModal({
  teams,
  existing,
  onClose,
}: {
  teams: Team[];
  existing?: Kpi;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function submit(formData: FormData) {
    setError("");
    startTransition(async () => {
      try {
        if (existing) {
          await updateKpi(existing.id, formData);
        } else {
          await createKpi(formData);
        }
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save this KPI.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated w-full max-w-sm rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{existing ? "Edit KPI" : "New KPI"}</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>
        <form action={submit} className="space-y-3">
          {!existing && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Team</span>
              <select name="teamId" required className="input">
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Name</span>
            <input name="name" required defaultValue={existing?.name} className="input" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Product / Section (optional)
            </span>
            <input
              name="product"
              placeholder="e.g. Detox US — leave blank to track the whole room"
              defaultValue={existing?.product ?? ""}
              className="input"
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Must match the product name used in the Daily Planner exactly.
            </span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Daily Target</span>
              <input name="target" type="number" step="0.1" min="0.01" required defaultValue={existing?.target} className="input" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Unit</span>
              <input name="unit" defaultValue={existing?.unit ?? "kg"} className="input" />
            </label>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : existing ? "Save Changes" : "Create KPI"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
