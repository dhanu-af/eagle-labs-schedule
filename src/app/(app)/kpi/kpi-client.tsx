"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createKpi, deleteKpi, setDailyTarget, updateKpi } from "@/lib/actions/kpi-actions";
import { pct, toDateInputValue } from "@/lib/ui";
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
                weekStartStr={weekStartStr}
                targets={dailyTargets}
                actuals={dailyActuals}
                unit={k.unit}
                canManage={canManage}
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
  weekStartStr,
  targets,
  actuals,
  unit,
  canManage,
}: {
  kpiId: string;
  weekStartStr: string;
  targets: number[];
  actuals: number[];
  unit: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState(targets);
  const [dirtyDays, setDirtyDays] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

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
