"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPostOpCheck, verifyPostOpCheck, unlockCheckRecord, deleteCheckRecord } from "@/lib/actions/checks-actions";
import { toDateInputValueUTC, todayInBrisbane, formatBrisbaneTime } from "@/lib/ui";
import type { CleaningType, PostOpItem } from "@/generated/prisma";
import type { PostOpRow } from "./checks-client";
import { STATUS_BADGE } from "./status-badge";
import { ExportButton } from "./export-button";
import { Field, SignatureField } from "./supervisor-preop-tab";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Th, THEAD_ROW_CLASS } from "@/components/ui/Th";

const ITEM_LABEL: Record<PostOpItem, string> = {
  BLENDING_ROOM: "Blending Room",
  V_BLENDER_1: "V Blender 1",
  V_BLENDER_2: "V Blender 2",
  CAPSULE_ROOM: "Capsule Room",
  CAPSULE_EQUIPMENT: "Capsule Equipment",
  CAPSULE_MACHINE: "Capsule Machine",
};

const BLENDING_ITEMS: PostOpItem[] = ["BLENDING_ROOM", "V_BLENDER_1", "V_BLENDER_2"];
const CAPSULE_ITEMS: PostOpItem[] = ["CAPSULE_ROOM", "CAPSULE_EQUIPMENT", "CAPSULE_MACHINE"];

const CLEANING_LABEL: Record<CleaningType, string> = {
  FULL_CLEAN: "Full Clean",
  PROVISIONAL_CLEAN: "Provisional Clean",
};

export default function PostOpTab({
  rows,
  canSubmit,
  canVerify,
  canUnlock,
  canDelete,
}: {
  rows: PostOpRow[];
  canSubmit: boolean;
  canVerify: boolean;
  canUnlock: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [filterItem, setFilterItem] = useState<PostOpItem | "">("");
  const [pending, startTransition] = useTransition();
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const filtered = useMemo(
    () => (filterItem ? rows.filter((r) => r.item === filterItem) : rows),
    [rows, filterItem]
  );

  function verify(id: string, status: string) {
    startTransition(async () => {
      await verifyPostOpCheck(id, status);
      router.refresh();
      setVerifyingId(null);
    });
  }

  function unlock(id: string) {
    startTransition(async () => {
      await unlockCheckRecord("POST_OP", id);
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this check record? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteCheckRecord("POST_OP", id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={filterItem}
          onChange={(e) => setFilterItem(e.target.value as PostOpItem | "")}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">All items</option>
          <optgroup label="Blending Room">
            {BLENDING_ITEMS.map((i) => (
              <option key={i} value={i}>
                {ITEM_LABEL[i]}
              </option>
            ))}
          </optgroup>
          <optgroup label="Capsule Room">
            {CAPSULE_ITEMS.map((i) => (
              <option key={i} value={i}>
                {ITEM_LABEL[i]}
              </option>
            ))}
          </optgroup>
        </select>
        <div className="flex gap-2">
          <ExportButton type="postop" />
          {canSubmit && <Button onClick={() => setShowForm(true)}>+ New Post-Op Check</Button>}
        </div>
      </div>

      <Card padding="none" className="overflow-x-auto">
        <table className="w-full min-w-[1150px] text-sm">
          <thead>
            <tr className={THEAD_ROW_CLASS}>
              <Th>Date</Th>
              <Th>Item</Th>
              <Th>Cleaning Type</Th>
              <Th>Verification</Th>
              <Th>Submitted By</Th>
              <Th>Verified By</Th>
              <Th>Status</Th>
              <Th>Comments</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 transition-colors duration-150 ease-out even:bg-surface-muted/30 hover:bg-surface-muted/60">
                <td className="px-3 py-2.5 text-muted-foreground">{r.date.slice(0, 10)}</td>
                <td className="px-3 py-2.5 text-foreground">{ITEM_LABEL[r.item]}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{CLEANING_LABEL[r.cleaningType]}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.cleaningVerificationStatus ?? "—"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {r.submittedByName}
                  <br />
                  <span className="text-xs">Signed {formatBrisbaneTime(r.submittedAt)}</span>
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">
                  {r.verifiedByName ? (
                    <>
                      ✓ {r.verifiedByName}
                      <br />
                      {r.verifiedAt && `Signed ${formatBrisbaneTime(r.verifiedAt)}`}
                    </>
                  ) : canVerify && !r.locked ? (
                    <button onClick={() => setVerifyingId(r.id)} className="font-medium text-info transition-colors duration-150 ease-out hover:opacity-80">
                      Verify
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2.5">{STATUS_BADGE[r.status]}</td>
                <td className="max-w-[200px] px-3 py-2.5 text-xs text-muted-foreground">{r.comments ?? "—"}</td>
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <EmptyState title="No records match these filters." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {showForm && <PostOpForm onClose={() => setShowForm(false)} />}
      {verifyingId && (
        <VerifyModal pending={pending} onClose={() => setVerifyingId(null)} onVerify={(status) => verify(verifyingId, status)} />
      )}
    </div>
  );
}

function PostOpForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createPostOpCheck({
          date: String(formData.get("date")),
          item: formData.get("item") as PostOpItem,
          cleaningType: formData.get("cleaningType") as CleaningType,
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
          <h2 className="text-base font-semibold text-foreground">Post-Operational Check</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>
        <form action={submit} className="space-y-3">
          <Field label="Date">
            <input name="date" type="date" required defaultValue={toDateInputValueUTC(todayInBrisbane())} className="input" />
          </Field>
          <Field label="Item">
            <select name="item" required className="input">
              <optgroup label="Blending Room">
                {BLENDING_ITEMS.map((i) => (
                  <option key={i} value={i}>
                    {ITEM_LABEL[i]}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Capsule Room">
                {CAPSULE_ITEMS.map((i) => (
                  <option key={i} value={i}>
                    {ITEM_LABEL[i]}
                  </option>
                ))}
              </optgroup>
            </select>
          </Field>
          <Field label="Cleaning Type">
            <select name="cleaningType" required className="input">
              <option value="FULL_CLEAN">Full Clean</option>
              <option value="PROVISIONAL_CLEAN">Provisional Clean</option>
            </select>
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

function VerifyModal({
  pending,
  onClose,
  onVerify,
}: {
  pending: boolean;
  onClose: () => void;
  onVerify: (status: string) => void;
}) {
  const [status, setStatus] = useState("Verified — Clean");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated w-full max-w-sm rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-base font-semibold text-foreground">Cleaning Verification</h2>
        <Field label="Verification Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            <option>Verified — Clean</option>
            <option>Rejected — Re-clean required</option>
          </select>
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending} onClick={() => onVerify(status)}>
            {pending ? "Saving..." : "Confirm Verification"}
          </Button>
        </div>
      </div>
    </div>
  );
}
