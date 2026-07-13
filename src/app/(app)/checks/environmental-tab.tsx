"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  createEnvironmentalCheck,
  approveEnvironmentalCheck,
  updateEnvironmentalLimit,
  unlockCheckRecord,
  deleteCheckRecord,
} from "@/lib/actions/checks-actions";
import { toDateInputValueUTC, todayInBrisbane, formatBrisbaneTime } from "@/lib/ui";
import type { EnvArea } from "@/generated/prisma";
import type { EnvironmentalCheckRow, EnvLimit } from "./checks-client";
import { STATUS_BADGE } from "./status-badge";
import { ExportButton } from "./export-button";
import { groupRecordsByPeriod } from "./group-records";
import { GroupToggle, GroupHeaderRow } from "./group-toggle";
import { Field, SignatureField } from "./supervisor-preop-tab";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Th, THEAD_ROW_CLASS } from "@/components/ui/Th";

const AREA_LABEL: Record<EnvArea, string> = {
  BLENDING_ROOM: "Blending Room",
  CAPSULE_ROOM: "Capsule Room",
};

type Grouping = "daily" | "weekly" | "monthly";

function groupKey(dateStr: string, grouping: Grouping) {
  const d = new Date(dateStr);
  if (grouping === "daily") return d.toISOString().slice(0, 10);
  if (grouping === "monthly") return d.toISOString().slice(0, 7);
  const monday = new Date(d);
  const day = monday.getDay();
  monday.setDate(monday.getDate() - ((day + 6) % 7));
  return `Week of ${monday.toISOString().slice(0, 10)}`;
}

export default function EnvironmentalTab({
  rows,
  limits,
  canRecord,
  canApproveSupervisor,
  canApproveQa,
  canConfigureLimits,
  canUnlock,
  canDelete,
}: {
  rows: EnvironmentalCheckRow[];
  limits: EnvLimit[];
  canRecord: boolean;
  canApproveSupervisor: boolean;
  canApproveQa: boolean;
  canConfigureLimits: boolean;
  canUnlock: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [showLimits, setShowLimits] = useState(false);
  const [filterArea, setFilterArea] = useState<EnvArea | "">("");
  const [grouping, setGrouping] = useState<Grouping>("daily");
  const [view, setView] = useState<"day" | "week">("day");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(
    () => (filterArea ? rows.filter((r) => r.area === filterArea) : rows),
    [rows, filterArea]
  );

  const groups = useMemo(() => groupRecordsByPeriod(filtered, (r) => r.date, view), [filtered, view]);

  const chartData = useMemo(() => {
    const area = filterArea || "BLENDING_ROOM";
    const relevant = rows.filter((r) => r.area === area).slice().reverse();
    const grouped = new Map<string, { temp: number[]; rh: number[] }>();
    for (const r of relevant) {
      const key = groupKey(r.date, grouping);
      if (!grouped.has(key)) grouped.set(key, { temp: [], rh: [] });
      grouped.get(key)!.temp.push(r.temperature);
      grouped.get(key)!.rh.push(r.humidity);
    }
    return Array.from(grouped.entries()).map(([key, v]) => ({
      period: key,
      temperature: Number((v.temp.reduce((a, b) => a + b, 0) / v.temp.length).toFixed(1)),
      humidity: Number((v.rh.reduce((a, b) => a + b, 0) / v.rh.length).toFixed(1)),
    }));
  }, [rows, filterArea, grouping]);

  function approve(id: string, as: "SUPERVISOR" | "QA") {
    startTransition(async () => {
      await approveEnvironmentalCheck(id, as);
      router.refresh();
    });
  }

  function unlock(id: string) {
    startTransition(async () => {
      await unlockCheckRecord("ENVIRONMENTAL", id);
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this check record? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteCheckRecord("ENVIRONMENTAL", id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <select
            value={filterArea}
            onChange={(e) => setFilterArea(e.target.value as EnvArea | "")}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
          >
            <option value="">All areas</option>
            <option value="BLENDING_ROOM">Blending Room</option>
            <option value="CAPSULE_ROOM">Capsule Room</option>
          </select>
        </div>
        <div className="flex gap-2">
          <ExportButton type="environmental" />
          {canConfigureLimits && (
            <Button variant="secondary" onClick={() => setShowLimits(true)}>
              Configure Limits
            </Button>
          )}
          {canRecord && <Button onClick={() => setShowForm(true)}>+ Record Reading</Button>}
        </div>
      </div>

      <Card padding="sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-foreground">
            Trend — {AREA_LABEL[(filterArea || "BLENDING_ROOM") as EnvArea]}
          </h3>
          <div className="flex gap-1">
            {(["daily", "weekly", "monthly"] as Grouping[]).map((g) => (
              <button
                key={g}
                onClick={() => setGrouping(g)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-150 ease-out ${
                  grouping === g ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"
                }`}
              >
                {g[0].toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {chartData.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No readings recorded yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="temp" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="rh" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line yAxisId="temp" type="monotone" dataKey="temperature" name="Temp °C" stroke="#34d399" strokeWidth={2} />
              <Line yAxisId="rh" type="monotone" dataKey="humidity" name="RH %" stroke="#38bdf8" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="flex items-center justify-end">
        <GroupToggle view={view} onChange={setView} />
      </div>

      <Card padding="none" className="overflow-x-auto">
        <table className="w-full min-w-[1150px] text-sm">
          <thead>
            <tr className={THEAD_ROW_CLASS}>
              <Th>Date</Th>
              <Th>Area</Th>
              <Th>Temp °C</Th>
              <Th>RH %</Th>
              <Th>Result</Th>
              <Th>Submitted By</Th>
              <Th>Supervisor</Th>
              <Th>QA</Th>
              <Th>Status</Th>
              <Th>Comments</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.key}>
                <GroupHeaderRow colSpan={11} label={g.label} count={g.rows.length} />
                {g.rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 transition-colors duration-150 ease-out even:bg-surface-muted/30 hover:bg-surface-muted/60">
                    <td className="px-3 py-2.5 text-muted-foreground">{r.date.slice(0, 10)}</td>
                    <td className="px-3 py-2.5 text-foreground">{AREA_LABEL[r.area]}</td>
                    <td className="px-3 py-2.5 tabular-nums">{r.temperature}</td>
                    <td className="px-3 py-2.5 tabular-nums">{r.humidity}</td>
                    <td className="px-3 py-2.5">
                      {r.passFail ? <Badge tone="success">Pass</Badge> : <Badge tone="danger">OOS</Badge>}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {r.submittedByName}
                      <br />
                      <span className="text-xs">Signed {formatBrisbaneTime(r.submittedAt)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {r.supervisorApprovedByName ? (
                        <>
                          ✓ {r.supervisorApprovedByName}
                          <br />
                          {r.supervisorApprovedAt && `Signed ${formatBrisbaneTime(r.supervisorApprovedAt)}`}
                        </>
                      ) : canApproveSupervisor && !r.locked ? (
                        <button disabled={pending} onClick={() => approve(r.id, "SUPERVISOR")} className="font-medium text-info transition-colors duration-150 ease-out hover:opacity-80">
                          Approve
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {r.qaApprovedByName ? (
                        <>
                          ✓ {r.qaApprovedByName}
                          <br />
                          {r.qaApprovedAt && `Signed ${formatBrisbaneTime(r.qaApprovedAt)}`}
                        </>
                      ) : canApproveQa && !r.locked ? (
                        <button disabled={pending} onClick={() => approve(r.id, "QA")} className="font-medium text-info transition-colors duration-150 ease-out hover:opacity-80">
                          Approve
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5">{STATUS_BADGE[r.status]}</td>
                    <td className="max-w-[200px] px-3 py-2.5 text-xs text-muted-foreground">{r.remarks ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {r.locked && canUnlock && (
                          <button disabled={pending} onClick={() => unlock(r.id)} className="text-xs font-medium text-info transition-colors duration-150 ease-out hover:opacity-80">
                            Unlock
                          </button>
                        )}
                        {canDelete && (
                          <button disabled={pending} onClick={() => remove(r.id)} className="text-xs font-medium text-danger transition-colors duration-150 ease-out hover:opacity-80">
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11}>
                  <EmptyState title="No records match these filters." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {showForm && <ReadingForm onClose={() => setShowForm(false)} />}
      {showLimits && <LimitsModal limits={limits} onClose={() => setShowLimits(false)} />}
    </div>
  );
}

function ReadingForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<boolean | null>(null);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await createEnvironmentalCheck({
          date: String(formData.get("date")),
          area: formData.get("area") as EnvArea,
          temperature: Number(formData.get("temperature")),
          humidity: Number(formData.get("humidity")),
          remarks: String(formData.get("remarks") ?? ""),
          signature: String(formData.get("signature") ?? ""),
        });
        setResult(res.passFail);
        router.refresh();
        setTimeout(onClose, res.passFail ? 400 : 1500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Record Environmental Reading</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>
        {result === false && (
          <div className="mb-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            Out of specification — managers have been notified.
          </div>
        )}
        <form action={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input name="date" type="date" required defaultValue={toDateInputValueUTC(todayInBrisbane())} className="input" />
            </Field>
            <Field label="Area">
              <select name="area" required className="input">
                <option value="BLENDING_ROOM">Blending Room</option>
                <option value="CAPSULE_ROOM">Capsule Room</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Temperature (°C)">
              <input name="temperature" type="number" step="0.1" required className="input" />
            </Field>
            <Field label="Relative Humidity (%)">
              <input name="humidity" type="number" step="0.1" required className="input" />
            </Field>
          </div>
          <Field label="Remarks">
            <textarea name="remarks" rows={2} className="input" />
          </Field>
          <SignatureField />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Signing & Submitting..." : "Sign & Submit"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LimitsModal({ limits, onClose }: { limits: EnvLimit[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const byArea = (area: EnvArea) => limits.find((l) => l.area === area);

  function save(area: EnvArea, formData: FormData) {
    startTransition(async () => {
      await updateEnvironmentalLimit(area, {
        minTemp: Number(formData.get("minTemp")),
        maxTemp: Number(formData.get("maxTemp")),
        minRH: Number(formData.get("minRH")),
        maxRH: Number(formData.get("maxRH")),
      });
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Configure Temperature & RH Limits</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>
        <div className="space-y-5">
          {(["BLENDING_ROOM", "CAPSULE_ROOM"] as EnvArea[]).map((area) => {
            const l = byArea(area);
            return (
              <form key={area} action={(fd) => save(area, fd)} className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-sm font-semibold text-foreground">{AREA_LABEL[area]}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Min Temp °C">
                    <input name="minTemp" type="number" step="0.1" defaultValue={l?.minTemp ?? 18} className="input" />
                  </Field>
                  <Field label="Max Temp °C">
                    <input name="maxTemp" type="number" step="0.1" defaultValue={l?.maxTemp ?? 25} className="input" />
                  </Field>
                  <Field label="Min RH %">
                    <input name="minRH" type="number" step="0.1" defaultValue={l?.minRH ?? 0} className="input" />
                  </Field>
                  <Field label="Max RH %">
                    <input name="maxRH" type="number" step="0.1" defaultValue={l?.maxRH ?? 40} className="input" />
                  </Field>
                </div>
                <Button type="submit" size="sm" disabled={pending}>
                  Save {AREA_LABEL[area]} Limits
                </Button>
              </form>
            );
          })}
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
