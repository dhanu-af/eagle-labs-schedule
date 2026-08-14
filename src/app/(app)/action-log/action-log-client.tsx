"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionSourceSection, ActionLogStatus, EscalationLevel, Priority } from "@/generated/prisma";
import {
  createActionLogEntry,
  updateActionLogEntry,
  updateActionLogStatus,
  deleteActionLogEntry,
} from "@/lib/actions/action-log-actions";
import {
  SOURCE_SECTION_LABELS,
  ACTION_LOG_STATUS_LABELS,
  ESCALATION_LEVEL_LABELS,
  PRIORITY_LABELS,
  computeDaysOpen,
  isActionOverdue,
  isOpenActionStatus,
} from "@/lib/action-log-defaults";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export type ActionLogRow = {
  id: string;
  actionNumber: string;
  dateRaised: string;
  sourceSection: ActionSourceSection;
  issue: string;
  businessImpact: string | null;
  priority: Priority;
  owner: string;
  dueDate: string | null;
  status: ActionLogStatus;
  escalationLevel: EscalationLevel;
  resolution: string | null;
  closedDate: string | null;
  createdByName: string | null;
};

const SOURCE_SECTIONS = Object.keys(SOURCE_SECTION_LABELS) as ActionSourceSection[];
const STATUSES = Object.keys(ACTION_LOG_STATUS_LABELS) as ActionLogStatus[];
const ESCALATIONS = Object.keys(ESCALATION_LEVEL_LABELS) as EscalationLevel[];
const PRIORITIES = Object.keys(PRIORITY_LABELS) as Priority[];

const STATUS_TONE: Record<ActionLogStatus, "muted" | "info" | "success" | "warning"> = {
  OPEN: "warning",
  IN_PROGRESS: "info",
  RESOLVED: "success",
  CLOSED: "muted",
};

const ESCALATION_TONE: Record<EscalationLevel, "success" | "warning" | "danger"> = {
  GREEN: "success",
  AMBER: "warning",
  RED: "danger",
};

const PRIORITY_TONE: Record<Priority, "danger" | "warning" | "info" | "muted"> = {
  CRITICAL: "danger",
  HIGH: "warning",
  MEDIUM: "info",
  LOW: "muted",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function toDateInput(iso: string | null) {
  return iso ? iso.slice(0, 10) : "";
}

type Draft = {
  sourceSection: ActionSourceSection;
  issue: string;
  businessImpact: string;
  priority: Priority;
  owner: string;
  dueDate: string;
  escalationLevel: EscalationLevel;
};

function emptyDraft(): Draft {
  return { sourceSection: "CROSS_FUNCTIONAL", issue: "", businessImpact: "", priority: "MEDIUM", owner: "", dueDate: "", escalationLevel: "GREEN" };
}

function draftFromEntry(entry: ActionLogRow): Draft {
  return {
    sourceSection: entry.sourceSection,
    issue: entry.issue,
    businessImpact: entry.businessImpact ?? "",
    priority: entry.priority,
    owner: entry.owner,
    dueDate: toDateInput(entry.dueDate),
    escalationLevel: entry.escalationLevel,
  };
}

function EntryModal({
  title,
  initial,
  onSave,
  onClose,
}: {
  title: string;
  initial: Draft;
  onSave: (draft: Draft) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function save() {
    setError("");
    if (!draft.issue.trim()) return setError("Issue / exception description is required.");
    if (!draft.owner.trim()) return setError("Owner is required.");

    startTransition(async () => {
      try {
        await onSave(draft);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save action.");
      }
    });
  }

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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Field label="Source Section">
              <select className="input" value={draft.sourceSection} onChange={(e) => setDraft((d) => ({ ...d, sourceSection: e.target.value as ActionSourceSection }))}>
                {SOURCE_SECTIONS.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_SECTION_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select className="input" value={draft.priority} onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value as Priority }))}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Escalation Level">
              <select className="input" value={draft.escalationLevel} onChange={(e) => setDraft((d) => ({ ...d, escalationLevel: e.target.value as EscalationLevel }))}>
                {ESCALATIONS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {ESCALATION_LEVEL_LABELS[lvl]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Issue / Exception">
            <textarea className="input" rows={2} value={draft.issue} onChange={(e) => setDraft((d) => ({ ...d, issue: e.target.value }))} />
          </Field>
          <Field label="Business Impact">
            <textarea className="input" rows={2} value={draft.businessImpact} onChange={(e) => setDraft((d) => ({ ...d, businessImpact: e.target.value }))} />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Owner">
              <input className="input" placeholder="Name or function, e.g. Warehouse Lead" value={draft.owner} onChange={(e) => setDraft((d) => ({ ...d, owner: e.target.value }))} />
            </Field>
            <Field label="Due Date">
              <input type="date" className="input" value={draft.dueDate} onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))} />
            </Field>
          </div>

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

function EntryCard({ entry, canManage }: { entry: ActionLogRow; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nextStatus, setNextStatus] = useState<ActionLogStatus>(entry.status);
  const [resolution, setResolution] = useState(entry.resolution ?? "");
  const [error, setError] = useState("");

  const daysOpen = computeDaysOpen(entry.dateRaised, entry.closedDate);
  const overdue = isActionOverdue(entry.dueDate, entry.status);

  function applyStatus() {
    startTransition(async () => {
      try {
        await updateActionLogStatus(entry.id, nextStatus, resolution);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't update status.");
      }
    });
  }

  function remove() {
    if (!confirm(`Delete action ${entry.actionNumber}? This can't be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteActionLogEntry(entry.id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't delete action.");
      }
    });
  }

  return (
    <Card padding="sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {entry.actionNumber} — {SOURCE_SECTION_LABELS[entry.sourceSection]}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{entry.issue}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Owner: <span className="text-foreground">{entry.owner}</span>
            {entry.dueDate && (
              <>
                {" "}
                · Due {new Date(entry.dueDate).toLocaleDateString()}
                {overdue && <span className="text-danger"> (overdue)</span>}
              </>
            )}
            {" "}
            · {daysOpen} day{daysOpen === 1 ? "" : "s"} open
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={PRIORITY_TONE[entry.priority]}>{PRIORITY_LABELS[entry.priority]}</Badge>
          <Badge tone={ESCALATION_TONE[entry.escalationLevel]}>{ESCALATION_LEVEL_LABELS[entry.escalationLevel].split(" — ")[0]}</Badge>
          <Badge tone={STATUS_TONE[entry.status]}>{ACTION_LOG_STATUS_LABELS[entry.status]}</Badge>
          <button onClick={() => setExpanded((e) => !e)} className="text-xs text-muted-foreground hover:text-foreground">
            {expanded ? "Hide" : "Details"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {entry.businessImpact && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Business impact: </span>
              {entry.businessImpact}
            </p>
          )}
          {entry.resolution && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Resolution / next step: </span>
              {entry.resolution}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Raised {new Date(entry.dateRaised).toLocaleDateString()}
            {entry.createdByName && ` by ${entry.createdByName}`}
            {entry.closedDate && ` · Closed ${new Date(entry.closedDate).toLocaleDateString()}`}
          </p>

          {canManage && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <select className="input w-44" value={nextStatus} onChange={(e) => setNextStatus(e.target.value as ActionLogStatus)}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {ACTION_LOG_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                <input
                  className="input flex-1"
                  placeholder="Resolution / next step..."
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                />
                <Button size="sm" onClick={applyStatus} disabled={pending}>
                  Update
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setEditing(true)} className="text-xs text-muted-foreground hover:text-foreground">
                  Edit details
                </button>
                <button onClick={remove} className="text-xs text-danger hover:underline">
                  Delete
                </button>
              </div>
            </div>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      )}

      {editing && (
        <EntryModal
          title={`Edit ${entry.actionNumber}`}
          initial={draftFromEntry(entry)}
          onClose={() => setEditing(false)}
          onSave={async (draft) => {
            await updateActionLogEntry(entry.id, {
              sourceSection: draft.sourceSection,
              issue: draft.issue,
              businessImpact: draft.businessImpact || null,
              priority: draft.priority,
              owner: draft.owner,
              dueDate: draft.dueDate || null,
              escalationLevel: draft.escalationLevel,
            });
            router.refresh();
          }}
        />
      )}
    </Card>
  );
}

export default function ActionLogClient({ entries, canManage }: { entries: ActionLogRow[]; canManage: boolean }) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ActionLogStatus | "ALL" | "OPEN_ONLY">("OPEN_ONLY");
  const [sectionFilter, setSectionFilter] = useState<ActionSourceSection | "ALL">("ALL");
  const [escalationFilter, setEscalationFilter] = useState<EscalationLevel | "ALL">("ALL");

  const stats = useMemo(() => {
    const open = entries.filter((e) => isOpenActionStatus(e.status));
    const overdue = open.filter((e) => isActionOverdue(e.dueDate, e.status));
    const red = open.filter((e) => e.escalationLevel === "RED");
    return { open: open.length, overdue: overdue.length, red: red.length };
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (statusFilter === "OPEN_ONLY" && !isOpenActionStatus(e.status)) return false;
      if (statusFilter !== "ALL" && statusFilter !== "OPEN_ONLY" && e.status !== statusFilter) return false;
      if (sectionFilter !== "ALL" && e.sourceSection !== sectionFilter) return false;
      if (escalationFilter !== "ALL" && e.escalationLevel !== escalationFilter) return false;
      if (q && !`${e.actionNumber} ${e.issue} ${e.owner} ${e.businessImpact ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, search, statusFilter, sectionFilter, escalationFilter]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Site Action Log"
        subtitle="One controlled list for shortages, delays, holds, downtime, and customer risks — every exception has an owner and a due date."
        actions={canManage ? <Button size="sm" onClick={() => setShowNew(true)}>+ Raise Action</Button> : undefined}
      />

      <div className="grid grid-cols-3 gap-3 sm:max-w-lg">
        <Card padding="sm">
          <p className="text-xs text-muted-foreground">Open actions</p>
          <p className="text-xl font-semibold text-foreground">{stats.open}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-muted-foreground">Overdue</p>
          <p className="text-xl font-semibold text-danger">{stats.overdue}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-muted-foreground">Red escalation</p>
          <p className="text-xl font-semibold text-danger">{stats.red}</p>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-full sm:w-64" placeholder="Search issue, owner, action #..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="OPEN_ONLY">Open + In Progress</option>
          <option value="ALL">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {ACTION_LOG_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select className="input w-52" value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value as typeof sectionFilter)}>
          <option value="ALL">All sections</option>
          {SOURCE_SECTIONS.map((s) => (
            <option key={s} value={s}>
              {SOURCE_SECTION_LABELS[s]}
            </option>
          ))}
        </select>
        <select className="input w-44" value={escalationFilter} onChange={(e) => setEscalationFilter(e.target.value as typeof escalationFilter)}>
          <option value="ALL">All escalation</option>
          {ESCALATIONS.map((lvl) => (
            <option key={lvl} value={lvl}>
              {ESCALATION_LEVEL_LABELS[lvl].split(" — ")[0]}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No matching actions" description="Raise an action whenever a shortage, delay, hold, downtime, or customer risk needs an owner and a due date." />
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => (
            <EntryCard key={entry.id} entry={entry} canManage={canManage} />
          ))}
        </div>
      )}

      {showNew && (
        <EntryModal
          title="Raise Action"
          initial={emptyDraft()}
          onClose={() => setShowNew(false)}
          onSave={async (draft) => {
            await createActionLogEntry({
              sourceSection: draft.sourceSection,
              issue: draft.issue,
              businessImpact: draft.businessImpact || null,
              priority: draft.priority,
              owner: draft.owner,
              dueDate: draft.dueDate || null,
              escalationLevel: draft.escalationLevel,
            });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
