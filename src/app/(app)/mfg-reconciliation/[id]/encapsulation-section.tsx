"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveEncapsulation } from "@/lib/actions/mfg-reconciliation-actions";
import { computeYieldPct } from "@/lib/mfg-reconciliation-defaults";
import { Button } from "@/components/ui/Button";
import { Field, Section } from "./mfg-batch-detail-client";

export type EncapsulationData = {
  blendReceivedKg: number | null;
  blendUsedKg: number | null;
  blendRemainingKg: number | null;
  blendReturnedKg: number | null;
  powderWasteKg: number | null;
  samplingKg: number | null;
  capsuleSize: string | null;
  capsuleColour: string | null;
  capsuleLot: string | null;
  capsulesIssued: number | null;
  capsulesUsed: number | null;
  brokenCapsules: number | null;
  machineRejects: number | null;
  capsulesReturned: number | null;
  targetFillWeightMg: number | null;
  finishedCapsuleWeightKg: number | null;
  expectedCapsules: number | null;
  goodCapsules: number | null;
  rejectedCapsules: number | null;
  sampleCapsules: number | null;
  retentionCapsules: number | null;
  encapsulatedByName: string | null;
  encapsulatedAt: string | null;
  remarks: string | null;
};

function num(v: number | null | undefined) {
  return v?.toString() ?? "";
}

export default function EncapsulationSection({ batchId, data, canManage }: { batchId: string; data: EncapsulationData | null; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    blendReceivedKg: num(data?.blendReceivedKg),
    blendUsedKg: num(data?.blendUsedKg),
    blendRemainingKg: num(data?.blendRemainingKg),
    blendReturnedKg: num(data?.blendReturnedKg),
    powderWasteKg: num(data?.powderWasteKg),
    samplingKg: num(data?.samplingKg),
    capsuleSize: data?.capsuleSize ?? "",
    capsuleColour: data?.capsuleColour ?? "",
    capsuleLot: data?.capsuleLot ?? "",
    capsulesIssued: num(data?.capsulesIssued),
    capsulesUsed: num(data?.capsulesUsed),
    brokenCapsules: num(data?.brokenCapsules),
    machineRejects: num(data?.machineRejects),
    capsulesReturned: num(data?.capsulesReturned),
    targetFillWeightMg: num(data?.targetFillWeightMg),
    finishedCapsuleWeightKg: num(data?.finishedCapsuleWeightKg),
    expectedCapsules: num(data?.expectedCapsules),
    goodCapsules: num(data?.goodCapsules),
    rejectedCapsules: num(data?.rejectedCapsules),
    sampleCapsules: num(data?.sampleCapsules),
    retentionCapsules: num(data?.retentionCapsules),
    encapsulatedByName: data?.encapsulatedByName ?? "",
    encapsulatedAt: data?.encapsulatedAt?.slice(0, 10) ?? "",
    remarks: data?.remarks ?? "",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** Capsule count = blend weight (kg) x 1000, divided by the average fill weight per capsule (mg). */
  function capsulesFromWeight(blendKg: string, avgWeightMg: string): string {
    if (blendKg === "" || avgWeightMg === "") return "";
    const avgWeight = Number(avgWeightMg);
    if (!avgWeight) return "";
    return String(Math.round((Number(blendKg) * 1000) / avgWeight));
  }

  function setBlendReceivedKg(value: string) {
    setForm((f) => {
      const computed = capsulesFromWeight(value, f.targetFillWeightMg);
      return { ...f, blendReceivedKg: value, ...(computed !== "" ? { expectedCapsules: computed } : {}) };
    });
  }

  function setFinishedCapsuleWeightKg(value: string) {
    setForm((f) => {
      const computed = capsulesFromWeight(value, f.targetFillWeightMg);
      return { ...f, finishedCapsuleWeightKg: value, ...(computed !== "" ? { goodCapsules: computed } : {}) };
    });
  }

  function setTargetFillWeightMg(value: string) {
    setForm((f) => {
      const computedExpected = capsulesFromWeight(f.blendReceivedKg, value);
      const computedGood = capsulesFromWeight(f.finishedCapsuleWeightKg, value);
      return {
        ...f,
        targetFillWeightMg: value,
        ...(computedExpected !== "" ? { expectedCapsules: computedExpected } : {}),
        ...(computedGood !== "" ? { goodCapsules: computedGood } : {}),
      };
    });
  }

  const yieldPct = computeYieldPct(form.goodCapsules === "" ? null : Number(form.goodCapsules), form.expectedCapsules === "" ? null : Number(form.expectedCapsules));

  function save() {
    setError("");
    startTransition(async () => {
      try {
        await saveEncapsulation(batchId, {
          blendReceivedKg: form.blendReceivedKg === "" ? null : Number(form.blendReceivedKg),
          blendUsedKg: form.blendUsedKg === "" ? null : Number(form.blendUsedKg),
          blendRemainingKg: form.blendRemainingKg === "" ? null : Number(form.blendRemainingKg),
          blendReturnedKg: form.blendReturnedKg === "" ? null : Number(form.blendReturnedKg),
          powderWasteKg: form.powderWasteKg === "" ? null : Number(form.powderWasteKg),
          samplingKg: form.samplingKg === "" ? null : Number(form.samplingKg),
          capsuleSize: form.capsuleSize || null,
          capsuleColour: form.capsuleColour || null,
          capsuleLot: form.capsuleLot || null,
          capsulesIssued: form.capsulesIssued === "" ? null : Number(form.capsulesIssued),
          capsulesUsed: form.capsulesUsed === "" ? null : Number(form.capsulesUsed),
          brokenCapsules: form.brokenCapsules === "" ? null : Number(form.brokenCapsules),
          machineRejects: form.machineRejects === "" ? null : Number(form.machineRejects),
          capsulesReturned: form.capsulesReturned === "" ? null : Number(form.capsulesReturned),
          targetFillWeightMg: form.targetFillWeightMg === "" ? null : Number(form.targetFillWeightMg),
          finishedCapsuleWeightKg: form.finishedCapsuleWeightKg === "" ? null : Number(form.finishedCapsuleWeightKg),
          expectedCapsules: form.expectedCapsules === "" ? null : Number(form.expectedCapsules),
          goodCapsules: form.goodCapsules === "" ? null : Number(form.goodCapsules),
          rejectedCapsules: form.rejectedCapsules === "" ? null : Number(form.rejectedCapsules),
          sampleCapsules: form.sampleCapsules === "" ? null : Number(form.sampleCapsules),
          retentionCapsules: form.retentionCapsules === "" ? null : Number(form.retentionCapsules),
          encapsulatedByName: form.encapsulatedByName || null,
          encapsulatedAt: form.encapsulatedAt || null,
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
      <Section title="Blend Powder">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field label="Blend Received (kg)">
            <input type="number" className="input" disabled={!canManage} value={form.blendReceivedKg} onChange={(e) => setBlendReceivedKg(e.target.value)} />
          </Field>
          <Field label="Blend Used (kg)">
            <input type="number" className="input" disabled={!canManage} value={form.blendUsedKg} onChange={(e) => set("blendUsedKg", e.target.value)} />
          </Field>
          <Field label="Blend Remaining (kg)">
            <input type="number" className="input" disabled={!canManage} value={form.blendRemainingKg} onChange={(e) => set("blendRemainingKg", e.target.value)} />
          </Field>
          <Field label="Blend Returned (kg)">
            <input type="number" className="input" disabled={!canManage} value={form.blendReturnedKg} onChange={(e) => set("blendReturnedKg", e.target.value)} />
          </Field>
          <Field label="Powder Waste (kg)">
            <input type="number" className="input" disabled={!canManage} value={form.powderWasteKg} onChange={(e) => set("powderWasteKg", e.target.value)} />
          </Field>
          <Field label="Sampling (kg)">
            <input type="number" className="input" disabled={!canManage} value={form.samplingKg} onChange={(e) => set("samplingKg", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Empty Capsules">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field label="Capsule Size">
            <input className="input" disabled={!canManage} value={form.capsuleSize} onChange={(e) => set("capsuleSize", e.target.value)} />
          </Field>
          <Field label="Capsule Colour">
            <input className="input" disabled={!canManage} value={form.capsuleColour} onChange={(e) => set("capsuleColour", e.target.value)} />
          </Field>
          <Field label="Capsule Lot">
            <input className="input" disabled={!canManage} value={form.capsuleLot} onChange={(e) => set("capsuleLot", e.target.value)} />
          </Field>
          <Field label="Capsules Issued">
            <input type="number" className="input" disabled={!canManage} value={form.capsulesIssued} onChange={(e) => set("capsulesIssued", e.target.value)} />
          </Field>
          <Field label="Capsules Used">
            <input type="number" className="input" disabled={!canManage} value={form.capsulesUsed} onChange={(e) => set("capsulesUsed", e.target.value)} />
          </Field>
          <Field label="Broken Capsules">
            <input type="number" className="input" disabled={!canManage} value={form.brokenCapsules} onChange={(e) => set("brokenCapsules", e.target.value)} />
          </Field>
          <Field label="Machine Rejects">
            <input type="number" className="input" disabled={!canManage} value={form.machineRejects} onChange={(e) => set("machineRejects", e.target.value)} />
          </Field>
          <Field label="Capsules Returned">
            <input type="number" className="input" disabled={!canManage} value={form.capsulesReturned} onChange={(e) => set("capsulesReturned", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Production">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field label="Avg Weight / Target Fill Weight (mg)">
            <input type="number" className="input" disabled={!canManage} value={form.targetFillWeightMg} onChange={(e) => setTargetFillWeightMg(e.target.value)} />
          </Field>
          <Field label="Finished Capsule Weight (kg)">
            <input type="number" className="input" disabled={!canManage} value={form.finishedCapsuleWeightKg} onChange={(e) => setFinishedCapsuleWeightKg(e.target.value)} />
          </Field>
          <Field label="Expected Capsules">
            <input type="number" className="input" disabled={!canManage} value={form.expectedCapsules} onChange={(e) => set("expectedCapsules", e.target.value)} />
          </Field>
          <Field label="Good Capsules">
            <input type="number" className="input" disabled={!canManage} value={form.goodCapsules} onChange={(e) => set("goodCapsules", e.target.value)} />
          </Field>
          <Field label="Rejected Capsules">
            <input type="number" className="input" disabled={!canManage} value={form.rejectedCapsules} onChange={(e) => set("rejectedCapsules", e.target.value)} />
          </Field>
          <Field label="Sample Capsules">
            <input type="number" className="input" disabled={!canManage} value={form.sampleCapsules} onChange={(e) => set("sampleCapsules", e.target.value)} />
          </Field>
          <Field label="Retention Capsules">
            <input type="number" className="input" disabled={!canManage} value={form.retentionCapsules} onChange={(e) => set("retentionCapsules", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Output">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field label="Capsule Yield %">
            <p className="input flex items-center bg-surface-muted tabular-nums">{yieldPct !== null ? `${yieldPct.toFixed(1)}%` : "—"}</p>
          </Field>
          <Field label="Encapsulated By">
            <input className="input" disabled={!canManage} value={form.encapsulatedByName} onChange={(e) => set("encapsulatedByName", e.target.value)} />
          </Field>
          <Field label="Encapsulated At">
            <input type="date" className="input" disabled={!canManage} value={form.encapsulatedAt} onChange={(e) => set("encapsulatedAt", e.target.value)} />
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
            {pending ? "Saving..." : "Save Encapsulation"}
          </Button>
        </div>
      )}
    </div>
  );
}
