"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveBottling } from "@/lib/actions/mfg-reconciliation-actions";
import { computeYieldPct } from "@/lib/mfg-reconciliation-defaults";
import { Button } from "@/components/ui/Button";
import { Field, Section } from "./mfg-batch-detail-client";

export type BottlingData = {
  capsulesReceived: number | null;
  capsulesUsed: number | null;
  capsulesRemaining: number | null;
  bottlesIssued: number | null;
  bottlesUsed: number | null;
  damagedBottles: number | null;
  bottlesReturned: number | null;
  capsIssued: number | null;
  capsUsed: number | null;
  damagedCaps: number | null;
  capsReturned: number | null;
  desiccantsIssued: number | null;
  desiccantsUsed: number | null;
  damagedDesiccants: number | null;
  desiccantsReturned: number | null;
  bottleSize: string | null;
  targetCapsulesPerBottle: number | null;
  expectedBottles: number | null;
  filledBottles: number | null;
  rejectedBottles: number | null;
  qcSampleBottles: number | null;
  retentionBottles: number | null;
  bottledByName: string | null;
  bottledAt: string | null;
  remarks: string | null;
};

function num(v: number | null | undefined) {
  return v?.toString() ?? "";
}

export default function BottlingSection({ batchId, data, canManage }: { batchId: string; data: BottlingData | null; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    capsulesReceived: num(data?.capsulesReceived),
    capsulesUsed: num(data?.capsulesUsed),
    capsulesRemaining: num(data?.capsulesRemaining),
    bottlesIssued: num(data?.bottlesIssued),
    bottlesUsed: num(data?.bottlesUsed),
    damagedBottles: num(data?.damagedBottles),
    bottlesReturned: num(data?.bottlesReturned),
    capsIssued: num(data?.capsIssued),
    capsUsed: num(data?.capsUsed),
    damagedCaps: num(data?.damagedCaps),
    capsReturned: num(data?.capsReturned),
    desiccantsIssued: num(data?.desiccantsIssued),
    desiccantsUsed: num(data?.desiccantsUsed),
    damagedDesiccants: num(data?.damagedDesiccants),
    desiccantsReturned: num(data?.desiccantsReturned),
    bottleSize: data?.bottleSize ?? "",
    targetCapsulesPerBottle: num(data?.targetCapsulesPerBottle),
    expectedBottles: num(data?.expectedBottles),
    filledBottles: num(data?.filledBottles),
    rejectedBottles: num(data?.rejectedBottles),
    qcSampleBottles: num(data?.qcSampleBottles),
    retentionBottles: num(data?.retentionBottles),
    bottledByName: data?.bottledByName ?? "",
    bottledAt: data?.bottledAt?.slice(0, 10) ?? "",
    remarks: data?.remarks ?? "",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const yieldPct = computeYieldPct(form.filledBottles === "" ? null : Number(form.filledBottles), form.expectedBottles === "" ? null : Number(form.expectedBottles));

  function save() {
    setError("");
    startTransition(async () => {
      try {
        await saveBottling(batchId, {
          capsulesReceived: form.capsulesReceived === "" ? null : Number(form.capsulesReceived),
          capsulesUsed: form.capsulesUsed === "" ? null : Number(form.capsulesUsed),
          capsulesRemaining: form.capsulesRemaining === "" ? null : Number(form.capsulesRemaining),
          bottlesIssued: form.bottlesIssued === "" ? null : Number(form.bottlesIssued),
          bottlesUsed: form.bottlesUsed === "" ? null : Number(form.bottlesUsed),
          damagedBottles: form.damagedBottles === "" ? null : Number(form.damagedBottles),
          bottlesReturned: form.bottlesReturned === "" ? null : Number(form.bottlesReturned),
          capsIssued: form.capsIssued === "" ? null : Number(form.capsIssued),
          capsUsed: form.capsUsed === "" ? null : Number(form.capsUsed),
          damagedCaps: form.damagedCaps === "" ? null : Number(form.damagedCaps),
          capsReturned: form.capsReturned === "" ? null : Number(form.capsReturned),
          desiccantsIssued: form.desiccantsIssued === "" ? null : Number(form.desiccantsIssued),
          desiccantsUsed: form.desiccantsUsed === "" ? null : Number(form.desiccantsUsed),
          damagedDesiccants: form.damagedDesiccants === "" ? null : Number(form.damagedDesiccants),
          desiccantsReturned: form.desiccantsReturned === "" ? null : Number(form.desiccantsReturned),
          bottleSize: form.bottleSize || null,
          targetCapsulesPerBottle: form.targetCapsulesPerBottle === "" ? null : Number(form.targetCapsulesPerBottle),
          expectedBottles: form.expectedBottles === "" ? null : Number(form.expectedBottles),
          filledBottles: form.filledBottles === "" ? null : Number(form.filledBottles),
          rejectedBottles: form.rejectedBottles === "" ? null : Number(form.rejectedBottles),
          qcSampleBottles: form.qcSampleBottles === "" ? null : Number(form.qcSampleBottles),
          retentionBottles: form.retentionBottles === "" ? null : Number(form.retentionBottles),
          bottledByName: form.bottledByName || null,
          bottledAt: form.bottledAt || null,
          remarks: form.remarks || null,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Section title="Good Capsules">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field label="Capsules Received">
            <input type="number" className="input" disabled={!canManage} value={form.capsulesReceived} onChange={(e) => set("capsulesReceived", e.target.value)} />
          </Field>
          <Field label="Capsules Used">
            <input type="number" className="input" disabled={!canManage} value={form.capsulesUsed} onChange={(e) => set("capsulesUsed", e.target.value)} />
          </Field>
          <Field label="Capsules Remaining">
            <input type="number" className="input" disabled={!canManage} value={form.capsulesRemaining} onChange={(e) => set("capsulesRemaining", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Empty Bottles">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <Field label="Bottles Issued">
            <input type="number" className="input" disabled={!canManage} value={form.bottlesIssued} onChange={(e) => set("bottlesIssued", e.target.value)} />
          </Field>
          <Field label="Bottles Used">
            <input type="number" className="input" disabled={!canManage} value={form.bottlesUsed} onChange={(e) => set("bottlesUsed", e.target.value)} />
          </Field>
          <Field label="Damaged Bottles">
            <input type="number" className="input" disabled={!canManage} value={form.damagedBottles} onChange={(e) => set("damagedBottles", e.target.value)} />
          </Field>
          <Field label="Bottles Returned">
            <input type="number" className="input" disabled={!canManage} value={form.bottlesReturned} onChange={(e) => set("bottlesReturned", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Caps">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <Field label="Caps Issued">
            <input type="number" className="input" disabled={!canManage} value={form.capsIssued} onChange={(e) => set("capsIssued", e.target.value)} />
          </Field>
          <Field label="Caps Used">
            <input type="number" className="input" disabled={!canManage} value={form.capsUsed} onChange={(e) => set("capsUsed", e.target.value)} />
          </Field>
          <Field label="Damaged Caps">
            <input type="number" className="input" disabled={!canManage} value={form.damagedCaps} onChange={(e) => set("damagedCaps", e.target.value)} />
          </Field>
          <Field label="Caps Returned">
            <input type="number" className="input" disabled={!canManage} value={form.capsReturned} onChange={(e) => set("capsReturned", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Desiccants">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <Field label="Desiccants Issued">
            <input type="number" className="input" disabled={!canManage} value={form.desiccantsIssued} onChange={(e) => set("desiccantsIssued", e.target.value)} />
          </Field>
          <Field label="Desiccants Used">
            <input type="number" className="input" disabled={!canManage} value={form.desiccantsUsed} onChange={(e) => set("desiccantsUsed", e.target.value)} />
          </Field>
          <Field label="Damaged Desiccants">
            <input type="number" className="input" disabled={!canManage} value={form.damagedDesiccants} onChange={(e) => set("damagedDesiccants", e.target.value)} />
          </Field>
          <Field label="Desiccants Returned">
            <input type="number" className="input" disabled={!canManage} value={form.desiccantsReturned} onChange={(e) => set("desiccantsReturned", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Production">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field label="Bottle Size">
            <input className="input" disabled={!canManage} value={form.bottleSize} onChange={(e) => set("bottleSize", e.target.value)} />
          </Field>
          <Field label="Target Capsules per Bottle">
            <input type="number" className="input" disabled={!canManage} value={form.targetCapsulesPerBottle} onChange={(e) => set("targetCapsulesPerBottle", e.target.value)} />
          </Field>
          <Field label="Expected Bottles">
            <input type="number" className="input" disabled={!canManage} value={form.expectedBottles} onChange={(e) => set("expectedBottles", e.target.value)} />
          </Field>
          <Field label="Filled Bottles">
            <input type="number" className="input" disabled={!canManage} value={form.filledBottles} onChange={(e) => set("filledBottles", e.target.value)} />
          </Field>
          <Field label="Rejected Bottles">
            <input type="number" className="input" disabled={!canManage} value={form.rejectedBottles} onChange={(e) => set("rejectedBottles", e.target.value)} />
          </Field>
          <Field label="QC Sample Bottles">
            <input type="number" className="input" disabled={!canManage} value={form.qcSampleBottles} onChange={(e) => set("qcSampleBottles", e.target.value)} />
          </Field>
          <Field label="Retention Bottles">
            <input type="number" className="input" disabled={!canManage} value={form.retentionBottles} onChange={(e) => set("retentionBottles", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Output">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field label="Bottling Yield %">
            <p className="input flex items-center bg-surface-muted tabular-nums">{yieldPct !== null ? `${yieldPct.toFixed(1)}%` : "—"}</p>
          </Field>
          <Field label="Bottled By">
            <input className="input" disabled={!canManage} value={form.bottledByName} onChange={(e) => set("bottledByName", e.target.value)} />
          </Field>
          <Field label="Bottled At">
            <input type="date" className="input" disabled={!canManage} value={form.bottledAt} onChange={(e) => set("bottledAt", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Remarks">
        <textarea className="input" rows={2} disabled={!canManage} value={form.remarks} onChange={(e) => set("remarks", e.target.value)} />
      </Section>

      {error && <p className="text-xs text-danger">{error}</p>}
      {canManage && (
        <div className="text-right">
          <Button size="sm" onClick={save} disabled={pending}>
            {pending ? "Saving..." : "Save Bottling"}
          </Button>
        </div>
      )}
    </div>
  );
}
