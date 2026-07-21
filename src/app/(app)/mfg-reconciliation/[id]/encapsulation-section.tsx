"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveEncapsulation } from "@/lib/actions/mfg-reconciliation-actions";
import { capsulesFromKg, checkBelow, checkRange, type ReconciliationCheck } from "@/lib/mfg-reconciliation-defaults";
import { Button } from "@/components/ui/Button";
import { Field, Section } from "./mfg-batch-detail-client";

/// Mirrors the real "CAPSULE RECONCILIATION" form -- see MfgEncapsulation in schema.prisma for the
/// field-by-field mapping and mfg-reconciliation-defaults.ts for the shared calculation helpers.
export type EncapsulationData = {
  targetCapsuleFillWeightMg: number | null;
  avgCapsuleFullWeightMg: number | null;
  issuedBulkBlendKg: number | null;
  capsulesProducedKg: number | null;
  capsuleSamplesKg: number | null;
  rejectCapsulesKg: number | null;
  rejectPowderKg: number | null;
  avgCapsuleFillWeightMg: number | null;
  avgCapsuleLengthMm: number | null;
  avgDisintegrationMinutes: number | null;
  avgDisintegrationSeconds: number | null;
  disintegrationResult: string | null;
  completedByName: string | null;
  completedAt: string | null;
  checkedByName: string | null;
  checkedAt: string | null;
  comments: string | null;
};

function num(v: number | null | undefined) {
  return v?.toString() ?? "";
}

function n(v: string): number | null {
  return v === "" ? null : Number(v);
}

function ReconciliationRow({ check }: { check: ReconciliationCheck }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-border py-2 first:border-0 first:pt-0">
      <span className="text-sm text-foreground">{check.label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{check.limitLabel}</span>
        <span className="w-16 text-right text-sm font-medium tabular-nums text-foreground">
          {check.pct !== null ? `${check.pct.toFixed(1)}%` : "—"}
        </span>
        {check.pass !== null && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${check.pass ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
            {check.pass ? "Pass" : "Fail"}
          </span>
        )}
      </div>
    </div>
  );
}

export default function EncapsulationSection({ batchId, data, canManage }: { batchId: string; data: EncapsulationData | null; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    targetCapsuleFillWeightMg: num(data?.targetCapsuleFillWeightMg),
    avgCapsuleFullWeightMg: num(data?.avgCapsuleFullWeightMg),
    issuedBulkBlendKg: num(data?.issuedBulkBlendKg),
    capsulesProducedKg: num(data?.capsulesProducedKg),
    capsuleSamplesKg: num(data?.capsuleSamplesKg),
    rejectCapsulesKg: num(data?.rejectCapsulesKg),
    rejectPowderKg: num(data?.rejectPowderKg),
    avgCapsuleFillWeightMg: num(data?.avgCapsuleFillWeightMg),
    avgCapsuleLengthMm: num(data?.avgCapsuleLengthMm),
    avgDisintegrationMinutes: num(data?.avgDisintegrationMinutes),
    avgDisintegrationSeconds: num(data?.avgDisintegrationSeconds),
    disintegrationResult: data?.disintegrationResult ?? "",
    completedByName: data?.completedByName ?? "",
    completedAt: data?.completedAt?.slice(0, 10) ?? "",
    checkedByName: data?.checkedByName ?? "",
    checkedAt: data?.checkedAt?.slice(0, 10) ?? "",
    comments: data?.comments ?? "",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Batch Calculations -- mirrors the spreadsheet's "Batch Calculations" column exactly.
  const targetFillWeight = n(form.targetCapsuleFillWeightMg);
  const avgFullWeight = n(form.avgCapsuleFullWeightMg);
  const avgFillWeight = n(form.avgCapsuleFillWeightMg);
  const issuedBulkBlendKg = n(form.issuedBulkBlendKg);
  const capsulesProducedKg = n(form.capsulesProducedKg);
  const capsuleSamplesKg = n(form.capsuleSamplesKg);
  const rejectCapsulesKg = n(form.rejectCapsulesKg);
  const rejectPowderKg = n(form.rejectPowderKg);

  const theoreticalCapsules = capsulesFromKg(issuedBulkBlendKg, targetFillWeight);
  const capsulesProduced = capsulesFromKg(capsulesProducedKg, avgFullWeight);
  const capsuleSamples = capsulesFromKg(capsuleSamplesKg, avgFullWeight);
  const rejectCapsules = capsulesFromKg(rejectCapsulesKg, avgFullWeight);
  const blendInProducedCapsulesKg = capsulesProduced !== null && avgFillWeight !== null ? (capsulesProduced * avgFillWeight) / 1_000_000 : null;
  const bulkBlendAccountedForKg =
    blendInProducedCapsulesKg !== null && capsuleSamplesKg !== null && rejectCapsulesKg !== null && rejectPowderKg !== null
      ? blendInProducedCapsulesKg + capsuleSamplesKg + rejectCapsulesKg + rejectPowderKg
      : null;
  const bulkBlendUnaccountedForKg = issuedBulkBlendKg !== null && bulkBlendAccountedForKg !== null ? issuedBulkBlendKg - bulkBlendAccountedForKg : null;

  // Reconciliation -- mirrors the spreadsheet's "Reconciliation" section exactly.
  const capsuleReconciliationPct =
    capsulesProduced !== null && capsuleSamples !== null && rejectCapsules !== null && theoreticalCapsules
      ? ((capsulesProduced + capsuleSamples + rejectCapsules) / theoreticalCapsules) * 100
      : null;
  const blendReconciliationPct = bulkBlendAccountedForKg !== null && issuedBulkBlendKg ? (bulkBlendAccountedForKg / issuedBulkBlendKg) * 100 : null;
  const processYieldPct = capsulesProduced !== null && theoreticalCapsules ? (capsulesProduced / theoreticalCapsules) * 100 : null;
  const capsuleRejectionPct =
    rejectCapsules !== null && capsulesProduced !== null && capsulesProduced + rejectCapsules !== 0
      ? (rejectCapsules / (capsulesProduced + rejectCapsules)) * 100
      : null;

  const checks: ReconciliationCheck[] = [
    checkRange("Capsule Reconciliation", capsuleReconciliationPct, 98, 102),
    checkRange("Blend Reconciliation", blendReconciliationPct, 98, 102),
    checkRange("Process Yield", processYieldPct, 95, 102),
    checkBelow("Capsule Rejection", capsuleRejectionPct, 1.5),
  ];

  function save() {
    setError("");
    startTransition(async () => {
      try {
        await saveEncapsulation(batchId, {
          targetCapsuleFillWeightMg: targetFillWeight,
          avgCapsuleFullWeightMg: avgFullWeight,
          issuedBulkBlendKg,
          capsulesProducedKg,
          capsuleSamplesKg,
          rejectCapsulesKg,
          rejectPowderKg,
          avgCapsuleFillWeightMg: avgFillWeight,
          avgCapsuleLengthMm: n(form.avgCapsuleLengthMm),
          avgDisintegrationMinutes: n(form.avgDisintegrationMinutes),
          avgDisintegrationSeconds: n(form.avgDisintegrationSeconds),
          disintegrationResult: form.disintegrationResult || null,
          completedByName: form.completedByName || null,
          completedAt: form.completedAt || null,
          checkedByName: form.checkedByName || null,
          checkedAt: form.checkedAt || null,
          comments: form.comments || null,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Section title="Header">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Field label="Target Capsule Fill Weight (mg)">
            <input type="number" className="input" disabled={!canManage} value={form.targetCapsuleFillWeightMg} onChange={(e) => set("targetCapsuleFillWeightMg", e.target.value)} />
          </Field>
          <Field label="Average Capsule Full Weight (mg)">
            <input type="number" className="input" disabled={!canManage} value={form.avgCapsuleFullWeightMg} onChange={(e) => set("avgCapsuleFullWeightMg", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Batch Total Weights (kg)">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field label="Issued Bulk Blend (kg)">
            <input type="number" className="input" disabled={!canManage} value={form.issuedBulkBlendKg} onChange={(e) => set("issuedBulkBlendKg", e.target.value)} />
          </Field>
          <Field label="Capsules Produced (kg)">
            <input type="number" className="input" disabled={!canManage} value={form.capsulesProducedKg} onChange={(e) => set("capsulesProducedKg", e.target.value)} />
          </Field>
          <Field label="Capsule Samples (kg)">
            <input type="number" className="input" disabled={!canManage} value={form.capsuleSamplesKg} onChange={(e) => set("capsuleSamplesKg", e.target.value)} />
          </Field>
          <Field label="Reject Capsules (kg)">
            <input type="number" className="input" disabled={!canManage} value={form.rejectCapsulesKg} onChange={(e) => set("rejectCapsulesKg", e.target.value)} />
          </Field>
          <Field label="Reject Powder (kg)">
            <input type="number" className="input" disabled={!canManage} value={form.rejectPowderKg} onChange={(e) => set("rejectPowderKg", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Batch Calculations">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field label="Theoretical No. of Capsules">
            <p className="input flex items-center bg-surface-muted tabular-nums">{theoreticalCapsules !== null ? Math.round(theoreticalCapsules).toLocaleString() : "—"}</p>
          </Field>
          <Field label="No. of Capsules Produced">
            <p className="input flex items-center bg-surface-muted tabular-nums">{capsulesProduced !== null ? Math.round(capsulesProduced).toLocaleString() : "—"}</p>
          </Field>
          <Field label="No. of Capsule Samples">
            <p className="input flex items-center bg-surface-muted tabular-nums">{capsuleSamples !== null ? Math.round(capsuleSamples).toLocaleString() : "—"}</p>
          </Field>
          <Field label="No. of Reject Capsules">
            <p className="input flex items-center bg-surface-muted tabular-nums">{rejectCapsules !== null ? Math.round(rejectCapsules).toLocaleString() : "—"}</p>
          </Field>
          <Field label="Bulk Blend Accounted For (kg)">
            <p className="input flex items-center bg-surface-muted tabular-nums">{bulkBlendAccountedForKg !== null ? bulkBlendAccountedForKg.toFixed(2) : "—"}</p>
          </Field>
          <Field label="Bulk Blend Unaccounted For (kg)">
            <p className="input flex items-center bg-surface-muted tabular-nums">{bulkBlendUnaccountedForKg !== null ? bulkBlendUnaccountedForKg.toFixed(2) : "—"}</p>
          </Field>
        </div>
      </Section>

      <Section title="Capsule Properties">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field label="Average Capsule Fill Weight (mg)">
            <input type="number" className="input" disabled={!canManage} value={form.avgCapsuleFillWeightMg} onChange={(e) => set("avgCapsuleFillWeightMg", e.target.value)} />
          </Field>
          <Field label="Average Capsule Length (mm)">
            <input type="number" className="input" disabled={!canManage} value={form.avgCapsuleLengthMm} onChange={(e) => set("avgCapsuleLengthMm", e.target.value)} />
          </Field>
          <Field label="Average Disintegration">
            <div className="flex gap-1">
              <input type="number" className="input" placeholder="mins" disabled={!canManage} value={form.avgDisintegrationMinutes} onChange={(e) => set("avgDisintegrationMinutes", e.target.value)} />
              <input type="number" className="input" placeholder="secs" disabled={!canManage} value={form.avgDisintegrationSeconds} onChange={(e) => set("avgDisintegrationSeconds", e.target.value)} />
            </div>
          </Field>
          <Field label="Disintegration Result">
            <select className="input" disabled={!canManage} value={form.disintegrationResult} onChange={(e) => set("disintegrationResult", e.target.value)}>
              <option value="">Select...</option>
              <option value="Pass">Pass</option>
              <option value="Fail">Fail</option>
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Reconciliation">
        <div>
          {checks.map((c) => (
            <ReconciliationRow key={c.label} check={c} />
          ))}
        </div>
      </Section>

      <Section title="Sign-off">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Field label="Completed By (Signature)">
            <input className="input" disabled={!canManage} value={form.completedByName} onChange={(e) => set("completedByName", e.target.value)} />
          </Field>
          <Field label="Completed Date">
            <input type="date" className="input" disabled={!canManage} value={form.completedAt} onChange={(e) => set("completedAt", e.target.value)} />
          </Field>
          <Field label="Checked By (Signature)">
            <input className="input" disabled={!canManage} value={form.checkedByName} onChange={(e) => set("checkedByName", e.target.value)} />
          </Field>
          <Field label="Checked Date">
            <input type="date" className="input" disabled={!canManage} value={form.checkedAt} onChange={(e) => set("checkedAt", e.target.value)} />
          </Field>
        </div>
        <Field label="Comments">
          <textarea className="input" rows={2} disabled={!canManage} value={form.comments} onChange={(e) => set("comments", e.target.value)} />
        </Field>
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
