"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EscalationLevel } from "@/generated/prisma";
import {
  computeWeeklyKpiSuggestions,
  upsertWeeklyKpiScorecard,
  deleteWeeklyKpiScorecard,
  type WeeklyKpiScorecardInput,
} from "@/lib/actions/weekly-kpi-actions";
import { currentWeekEnding, formatWeekLabel, SCORECARD_FIELDS, ESCALATION_LEVEL_LABELS, type ScorecardFieldKey } from "@/lib/weekly-kpi-defaults";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export type ScorecardRow = {
  id: string;
  weekEnding: string;
  otifPct: number | null;
  scheduleAdherencePct: number | null;
  materialAvailabilityPct: number | null;
  productionAttainmentPct: number | null;
  averageYieldPct: number | null;
  qcOnTimeReleasePct: number | null;
  inventoryAccuracyPct: number | null;
  pastDueOrders: number | null;
  criticalShortages: number | null;
  unplannedScheduleChanges: number | null;
  overallStatus: EscalationLevel;
  managementComment: string | null;
  createdByName: string | null;
};

const STATUSES = Object.keys(ESCALATION_LEVEL_LABELS) as EscalationLevel[];
const STATUS_TONE: Record<EscalationLevel, "success" | "warning" | "danger"> = { GREEN: "success", AMBER: "warning", RED: "danger" };

type Draft = Record<ScorecardFieldKey, string> & { overallStatus: EscalationLevel; managementComment: string };

function emptyDraft(): Draft {
  const base: Partial<Draft> = { overallStatus: "GREEN", managementComment: "" };
  for (const f of SCORECARD_FIELDS) base[f.key] = "";
  return base as Draft;
}

function draftFromRow(row: ScorecardRow): Draft {
  const base: Partial<Draft> = { overallStatus: row.overallStatus, managementComment: row.managementComment ?? "" };
  for (const f of SCORECARD_FIELDS) {
    const v = row[f.key];
    base[f.key] = v == null ? "" : String(v);
  }
  return base as Draft;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
        {hint && <span className="ml-1 font-normal text-muted-foreground/70">({hint})</span>}
      </span>
      {children}
    </label>
  );
}

function ScorecardModal({
  title,
  weekEndingIso,
  initial,
  canSuggest,
  onSave,
  onClose,
}: {
  title: string;
  weekEndingIso: string;
  initial: Draft;
  canSuggest: boolean;
  onSave: (draft: Draft) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [pending, startTransition] = useTransition();
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState("");

  function set(key: ScorecardFieldKey, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function suggest() {
    setError("");
    setSuggesting(true);
    startTransition(async () => {
      try {
        const suggestions = await computeWeeklyKpiSuggestions(weekEndingIso);
        setDraft((d) => ({
          ...d,
          otifPct: suggestions.otifPct != null ? String(suggestions.otifPct) : d.otifPct,
          pastDueOrders: suggestions.pastDueOrders != null ? String(suggestions.pastDueOrders) : d.pastDueOrders,
          materialAvailabilityPct: suggestions.materialAvailabilityPct != null ? String(suggestions.materialAvailabilityPct) : d.materialAvailabilityPct,
          criticalShortages: suggestions.criticalShortages != null ? String(suggestions.criticalShortages) : d.criticalShortages,
          productionAttainmentPct: suggestions.productionAttainmentPct != null ? String(suggestions.productionAttainmentPct) : d.productionAttainmentPct,
          averageYieldPct: suggestions.averageYieldPct != null ? String(suggestions.averageYieldPct) : d.averageYieldPct,
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't compute suggestions.");
      } finally {
        setSuggesting(false);
      }
    });
  }

  function save() {
    setError("");
    startTransition(async () => {
      try {
        await onSave(draft);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save scorecard.");
      }
    });
  }

  const computedFields = SCORECARD_FIELDS.filter((f) => f.source === "computed");
  const manualFields = SCORECARD_FIELDS.filter((f) => f.source === "manual");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Computed from live data — accept or override</span>
              {canSuggest && (
                <Button size="sm" variant="secondary" onClick={suggest} disabled={suggesting || pending}>
                  {suggesting ? "Computing..." : "Suggest values"}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {computedFields.map((f) => (
                <Field key={f.key} label={f.label}>
                  <input
                    type="number"
                    step={f.unit === "%" ? "0.1" : "1"}
                    className="input"
                    value={draft[f.key]}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                </Field>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Manual entry — no automated source yet</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {manualFields.map((f) => (
                <Field key={f.key} label={f.label}>
                  <input
                    type="number"
                    step={f.unit === "%" ? "0.1" : "1"}
                    className="input"
                    value={draft[f.key]}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                </Field>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Overall Status">
              <select className="input" value={draft.overallStatus} onChange={(e) => setDraft((d) => ({ ...d, overallStatus: e.target.value as EscalationLevel }))}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {ESCALATION_LEVEL_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Management Comment">
            <textarea className="input" rows={3} value={draft.managementComment} onChange={(e) => setDraft((d) => ({ ...d, managementComment: e.target.value }))} />
          </Field>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScorecardCard({ row, canManage }: { row: ScorecardRow; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");

  function remove() {
    if (!confirm(`Delete the scorecard for week ending ${new Date(row.weekEnding).toLocaleDateString()}?`)) return;
    startTransition(async () => {
      try {
        await deleteWeeklyKpiScorecard(row.id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't delete scorecard.");
      }
    });
  }

  return (
    <Card padding="sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">Week of {formatWeekLabel(new Date(row.weekEnding))}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            OTIF {row.otifPct ?? "—"}% · Attainment {row.productionAttainmentPct ?? "—"}% · {row.pastDueOrders ?? "—"} past-due · {row.criticalShortages ?? "—"} critical shortages
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONE[row.overallStatus]}>{ESCALATION_LEVEL_LABELS[row.overallStatus]}</Badge>
          <button onClick={() => setExpanded((e) => !e)} className="text-xs text-muted-foreground hover:text-foreground">
            {expanded ? "Hide" : "Details"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
            {SCORECARD_FIELDS.map((f) => (
              <div key={f.key}>
                <p className="text-muted-foreground">{f.label}</p>
                <p className="font-medium text-foreground">
                  {row[f.key] ?? "—"}
                  {row[f.key] != null && f.unit === "%" ? "%" : ""}
                </p>
              </div>
            ))}
          </div>
          {row.managementComment && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Comment: </span>
              {row.managementComment}
            </p>
          )}
          {row.createdByName && <p className="text-xs text-muted-foreground">Recorded by {row.createdByName}</p>}

          {canManage && (
            <div className="flex items-center gap-3">
              <button onClick={() => setEditing(true)} className="text-xs text-muted-foreground hover:text-foreground">
                Edit
              </button>
              <button onClick={remove} className="text-xs text-danger hover:underline" disabled={pending}>
                Delete
              </button>
            </div>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      )}

      {editing && (
        <ScorecardModal
          title={`Edit week ending ${new Date(row.weekEnding).toLocaleDateString()}`}
          weekEndingIso={row.weekEnding}
          initial={draftFromRow(row)}
          canSuggest
          onClose={() => setEditing(false)}
          onSave={async (draft) => {
            await upsertWeeklyKpiScorecard(row.weekEnding, draftToInput(draft));
            router.refresh();
          }}
        />
      )}
    </Card>
  );
}

function draftToInput(draft: Draft): WeeklyKpiScorecardInput {
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  return {
    otifPct: num(draft.otifPct),
    scheduleAdherencePct: num(draft.scheduleAdherencePct),
    materialAvailabilityPct: num(draft.materialAvailabilityPct),
    productionAttainmentPct: num(draft.productionAttainmentPct),
    averageYieldPct: num(draft.averageYieldPct),
    qcOnTimeReleasePct: num(draft.qcOnTimeReleasePct),
    inventoryAccuracyPct: num(draft.inventoryAccuracyPct),
    pastDueOrders: num(draft.pastDueOrders),
    criticalShortages: num(draft.criticalShortages),
    unplannedScheduleChanges: num(draft.unplannedScheduleChanges),
    overallStatus: draft.overallStatus,
    managementComment: draft.managementComment || null,
  };
}

export default function WeeklyKpiClient({ scorecards, canManage }: { scorecards: ScorecardRow[]; canManage: boolean }) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);

  const thisWeekIso = useMemo(() => currentWeekEnding().toISOString(), []);
  const thisWeekExists = scorecards.some((s) => new Date(s.weekEnding).toDateString() === new Date(thisWeekIso).toDateString());

  return (
    <div className="space-y-4">
      <PageHeader
        title="Weekly KPI Scorecard"
        subtitle="OTIF, schedule adherence, material availability, yield, and the rest — one number per week, for management review."
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setShowNew(true)}>
              {thisWeekExists ? "Edit This Week" : "+ Record This Week"}
            </Button>
          ) : undefined
        }
      />

      {scorecards.length === 0 ? (
        <EmptyState title="No scorecards recorded yet" description="Record this week's numbers to start the weekly management review history." />
      ) : (
        <div className="space-y-2">
          {scorecards.map((row) => (
            <ScorecardCard key={row.id} row={row} canManage={canManage} />
          ))}
        </div>
      )}

      {showNew && (
        <ScorecardModal
          title={`Week ending ${new Date(thisWeekIso).toLocaleDateString()}`}
          weekEndingIso={thisWeekIso}
          initial={
            thisWeekExists
              ? draftFromRow(scorecards.find((s) => new Date(s.weekEnding).toDateString() === new Date(thisWeekIso).toDateString())!)
              : emptyDraft()
          }
          canSuggest
          onClose={() => setShowNew(false)}
          onSave={async (draft) => {
            await upsertWeeklyKpiScorecard(thisWeekIso, draftToInput(draft));
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
