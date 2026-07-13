"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWorkLog, approveWorkLog, unlockCheckRecord, deleteCheckRecord } from "@/lib/actions/checks-actions";
import { toDateInputValueUTC, todayInBrisbane, formatBrisbaneTime } from "@/lib/ui";
import type { WorkLogRoom, WorkLogActivity } from "@/generated/prisma";
import type { WorkLogRow } from "./checks-client";
import { STATUS_BADGE } from "./status-badge";
import { ExportButton } from "./export-button";
import { groupRecordsByPeriod } from "./group-records";
import { GroupToggle, GroupHeaderRow } from "./group-toggle";
import { Field, SignatureField } from "./supervisor-preop-tab";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Th, THEAD_ROW_CLASS } from "@/components/ui/Th";

export const ROOM_LABEL: Record<WorkLogRoom, string> = {
  ENCAPSULATION_ROOM: "Encapsulation Room",
  BLENDING_ROOM: "Blending Room",
};

const ACTIVITY_LABEL: Record<WorkLogActivity, string> = {
  ENCAPSULATION: "Encapsulation",
  DISPENSING_MIXING: "Dispensing / Mixing",
  GUMMY_POLISHING: "Gummy Polishing",
  SORTING_REWORK: "Sorting / Rework",
  PACKING: "Packing",
  GUMMY_COATING: "Gummy Coating",
  POLISHING: "Polishing",
  SET_UP: "Set Up",
  TESTING: "Testing",
  CLEANING_PROVISIONAL: "Cleaning (Provisional)",
  CLEANING_FULL: "Cleaning (Full)",
  OTHERS: "Others",
  BREAKDOWN: "Breakdown",
};

const ACTIVITY_ORDER: WorkLogActivity[] = [
  "ENCAPSULATION",
  "DISPENSING_MIXING",
  "GUMMY_POLISHING",
  "SORTING_REWORK",
  "PACKING",
  "GUMMY_COATING",
  "POLISHING",
  "SET_UP",
  "TESTING",
  "CLEANING_PROVISIONAL",
  "CLEANING_FULL",
  "OTHERS",
  "BREAKDOWN",
];

export default function WorkLogTab({
  rows,
  canSubmit,
  canApprove,
  canUnlock,
  canDelete,
}: {
  rows: WorkLogRow[];
  canSubmit: boolean;
  canApprove: boolean;
  canUnlock: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [room, setRoom] = useState<WorkLogRoom>("ENCAPSULATION_ROOM");
  const [showForm, setShowForm] = useState(false);
  const [filterDate, setFilterDate] = useState("");
  const [view, setView] = useState<"day" | "week">("day");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (r.room !== room) return false;
        if (filterDate && r.startDate.slice(0, 10) !== filterDate) return false;
        return true;
      }),
    [rows, room, filterDate]
  );

  const groups = useMemo(() => groupRecordsByPeriod(filtered, (r) => r.startDate, view), [filtered, view]);

  function approve(id: string) {
    startTransition(async () => {
      await approveWorkLog(id);
      router.refresh();
    });
  }

  function unlock(id: string) {
    startTransition(async () => {
      await unlockCheckRecord("WORK_LOG", id);
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this work log entry? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteCheckRecord("WORK_LOG", id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(ROOM_LABEL) as WorkLogRoom[]).map((r) => (
          <button
            key={r}
            onClick={() => setRoom(r)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-out ${
              room === r
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {ROOM_LABEL[r]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
        />
        <div className="flex items-center gap-2">
          <GroupToggle view={view} onChange={setView} />
          <ExportButton type="worklog" />
          {canSubmit && <Button onClick={() => setShowForm(true)}>+ New Work Log Entry</Button>}
        </div>
      </div>

      <Card padding="none" className="overflow-x-auto">
        <table className="w-full min-w-[1500px] text-sm">
          <thead>
            <tr className={THEAD_ROW_CLASS}>
              <Th>OP Name</Th>
              <Th>Start Date</Th>
              <Th>Start Time</Th>
              <Th>Product Name</Th>
              <Th>Product Code</Th>
              <Th>Batch Number</Th>
              <Th>Activity</Th>
              <Th>End Date</Th>
              <Th>End Time</Th>
              <Th>OP Name (Closing)</Th>
              <Th>Sign</Th>
              <Th>Supervisor Sign/Date</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.key}>
                <GroupHeaderRow colSpan={14} label={g.label} count={g.rows.length} />
                {g.rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 transition-colors duration-150 ease-out even:bg-surface-muted/30 hover:bg-surface-muted/60">
                    <td className="px-3 py-2.5 text-foreground">{r.opName}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.startDate.slice(0, 10)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.startTime}</td>
                    <td className="px-3 py-2.5 text-foreground">{r.productName}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.productCode}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.batchNumber}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {ACTIVITY_LABEL[r.activity]}
                      {r.activity === "OTHERS" && r.activityOther ? ` — ${r.activityOther}` : ""}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.endDate?.slice(0, 10) ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.endTime ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.closingOpName ?? "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {r.signature}
                      <br />
                      <span>Signed {formatBrisbaneTime(r.submittedAt)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {r.supervisorApprovedByName ? (
                        <>
                          ✓ {r.supervisorApprovedByName}
                          <br />
                          {r.supervisorApprovedAt && formatBrisbaneTime(r.supervisorApprovedAt)}
                        </>
                      ) : canApprove && !r.locked ? (
                        <button disabled={pending} onClick={() => approve(r.id)} className="font-medium text-info transition-colors duration-150 ease-out hover:opacity-80">
                          Approve
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5">{STATUS_BADGE[r.status]}</td>
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
                <td colSpan={14}>
                  <EmptyState title={`No ${ROOM_LABEL[room]} work log entries match these filters.`} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {showForm && <WorkLogForm defaultRoom={room} onClose={() => setShowForm(false)} />}
    </div>
  );
}

function WorkLogForm({ defaultRoom, onClose }: { defaultRoom: WorkLogRoom; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<WorkLogActivity>("ENCAPSULATION");

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createWorkLog({
          room: formData.get("room") as WorkLogRoom,
          opName: String(formData.get("opName") ?? ""),
          startDate: String(formData.get("startDate")),
          startTime: String(formData.get("startTime") ?? ""),
          productName: String(formData.get("productName") ?? ""),
          productCode: String(formData.get("productCode") ?? ""),
          batchNumber: String(formData.get("batchNumber") ?? ""),
          activity: formData.get("activity") as WorkLogActivity,
          activityOther: String(formData.get("activityOther") ?? ""),
          endDate: String(formData.get("endDate") ?? ""),
          endTime: String(formData.get("endTime") ?? ""),
          closingOpName: String(formData.get("closingOpName") ?? ""),
          comments: String(formData.get("comments") ?? ""),
          signature: String(formData.get("signature") ?? ""),
        });
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Work Log Entry</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>
        <form action={submit} className="space-y-3">
          <Field label="Room">
            <select name="room" required defaultValue={defaultRoom} className="input">
              {(Object.keys(ROOM_LABEL) as WorkLogRoom[]).map((r) => (
                <option key={r} value={r}>
                  {ROOM_LABEL[r]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="OP Name">
            <input name="opName" required placeholder="Operator name" className="input" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Date">
              <input name="startDate" type="date" required defaultValue={toDateInputValueUTC(todayInBrisbane())} className="input" />
            </Field>
            <Field label="Start Time">
              <input name="startTime" type="time" required className="input" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Product Name">
              <input name="productName" required className="input" />
            </Field>
            <Field label="Product Code">
              <input name="productCode" required className="input" />
            </Field>
          </div>
          <Field label="Batch Number">
            <input name="batchNumber" required className="input" />
          </Field>
          <Field label="Activity">
            <select
              name="activity"
              required
              value={activity}
              onChange={(e) => setActivity(e.target.value as WorkLogActivity)}
              className="input"
            >
              {ACTIVITY_ORDER.map((a) => (
                <option key={a} value={a}>
                  {ACTIVITY_LABEL[a]}
                </option>
              ))}
            </select>
          </Field>
          {activity === "OTHERS" && (
            <Field label="Activity — Other (describe)">
              <input name="activityOther" placeholder="Describe the activity" className="input" />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="End Date">
              <input name="endDate" type="date" className="input" />
            </Field>
            <Field label="End Time">
              <input name="endTime" type="time" className="input" />
            </Field>
          </div>
          <Field label="OP Name (Closing)">
            <input name="closingOpName" placeholder="Operator closing this entry (if different)" className="input" />
          </Field>
          <Field label="Comments">
            <textarea name="comments" rows={2} className="input" />
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
