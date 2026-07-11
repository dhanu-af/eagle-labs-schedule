"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPostOpCheck, verifyPostOpCheck, unlockCheckRecord } from "@/lib/actions/checks-actions";
import { toDateInputValueUTC, todayInBrisbane, formatBrisbaneTime } from "@/lib/ui";
import type { CleaningType, PostOpItem } from "@/generated/prisma";
import type { PostOpRow } from "./checks-client";
import { STATUS_BADGE } from "./status-badge";
import { ExportButton } from "./export-button";
import { Field, SignatureField } from "./supervisor-preop-tab";

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
}: {
  rows: PostOpRow[];
  canSubmit: boolean;
  canVerify: boolean;
  canUnlock: boolean;
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
          {canSubmit && (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              + New Post-Op Check
            </button>
          )}
        </div>
      </div>

      <div className="card-shadow overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Cleaning Type</th>
              <th className="px-3 py-2">Verification</th>
              <th className="px-3 py-2">Submitted By</th>
              <th className="px-3 py-2">Verified By</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-muted/50">
                <td className="px-3 py-2 text-muted-foreground">{r.date.slice(0, 10)}</td>
                <td className="px-3 py-2 text-foreground">{ITEM_LABEL[r.item]}</td>
                <td className="px-3 py-2 text-muted-foreground">{CLEANING_LABEL[r.cleaningType]}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.cleaningVerificationStatus ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {r.submittedByName}
                  <br />
                  <span className="text-xs">Signed {formatBrisbaneTime(r.submittedAt)}</span>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {r.verifiedByName ? (
                    <>
                      ✓ {r.verifiedByName}
                      <br />
                      {r.verifiedAt && `Signed ${formatBrisbaneTime(r.verifiedAt)}`}
                    </>
                  ) : canVerify && !r.locked ? (
                    <button onClick={() => setVerifyingId(r.id)} className="text-info hover:opacity-80">
                      Verify
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2">{STATUS_BADGE[r.status]}</td>
                <td className="px-3 py-2">
                  {r.locked && canUnlock && (
                    <button disabled={pending} onClick={() => unlock(r.id)} className="text-xs text-info hover:opacity-80">
                      Unlock
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No records match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Post-Operational Check</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
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
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-muted">
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Signing & Submitting..." : "Sign & Submit"}
            </button>
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
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-base font-semibold text-foreground">Cleaning Verification</h2>
        <Field label="Verification Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            <option>Verified — Clean</option>
            <option>Rejected — Re-clean required</option>
          </select>
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-muted">
            Cancel
          </button>
          <button
            disabled={pending}
            onClick={() => onVerify(status)}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Saving..." : "Confirm Verification"}
          </button>
        </div>
      </div>
    </div>
  );
}
