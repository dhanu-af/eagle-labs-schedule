"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveBottling } from "@/lib/actions/mfg-reconciliation-actions";
import { capsulesFromKg, checkBelow, checkRange, formatCount, type ReconciliationCheck } from "@/lib/mfg-reconciliation-defaults";
import { Button } from "@/components/ui/Button";
import { Field, Section } from "./mfg-batch-detail-client";

/// Mirrors the real "BOTTLE RECONCILIATION" form -- see MfgBottling in schema.prisma for the
/// field-by-field mapping and mfg-reconciliation-defaults.ts for the shared calculation helpers.
export type BottlingData = {
  totalCapsuleBulkWeightKg: number | null;
  avgCapsuleFullWeightMg: number | null;
  plannedQuantityBottles: number | null;
  capsuleReceivedKg: number | null;
  bottlesProduced: number | null;
  bottleUsed: number | null;
  desiccantsUsed: number | null;
  capsUsed: number | null;
  targetCapsulesPerBottle: number | null;
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

export default function BottlingSection({ batchId, data, canManage }: { batchId: string; data: BottlingData | null; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    totalCapsuleBulkWeightKg: num(data?.totalCapsuleBulkWeightKg),
    avgCapsuleFullWeightMg: num(data?.avgCapsuleFullWeightMg),
    plannedQuantityBottles: num(data?.plannedQuantityBottles),
    capsuleReceivedKg: num(data?.capsuleReceivedKg),
    bottlesProduced: num(data?.bottlesProduced),
    bottleUsed: num(data?.bottleUsed),
    desiccantsUsed: num(data?.desiccantsUsed),
    capsUsed: num(data?.capsUsed),
    targetCapsulesPerBottle: num(data?.targetCapsulesPerBottle),
    completedByName: data?.completedByName ?? "",
    completedAt: data?.completedAt?.slice(0, 10) ?? "",
    checkedByName: data?.checkedByName ?? "",
    checkedAt: data?.checkedAt?.slice(0, 10) ?? "",
    comments: data?.comments ?? "",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const avgFullWeight = n(form.avgCapsuleFullWeightMg);
  const plannedQuantityBottles = n(form.plannedQuantityBottles);
  const capsuleReceivedKg = n(form.capsuleReceivedKg);
  const bottlesProduced = n(form.bottlesProduced);
  const bottleUsed = n(form.bottleUsed);
  const desiccantsUsed = n(form.desiccantsUsed);
  const capsUsed = n(form.capsUsed);
  const targetCapsulesPerBottle = n(form.targetCapsulesPerBottle);

  // Batch Calculations -- mirrors the spreadsheet's "Batch Calculations" column exactly.
  const capsulesRequired = plannedQuantityBottles !== null && targetCapsulesPerBottle !== null ? plannedQuantityBottles * targetCapsulesPerBottle : null;
  const theoreticalCapsules = capsulesFromKg(capsuleReceivedKg, avgFullWeight);
  const theoreticalBottles = theoreticalCapsules !== null && targetCapsulesPerBottle ? theoreticalCapsules / targetCapsulesPerBottle : null;
  const capsulesUsed = bottlesProduced !== null && targetCapsulesPerBottle !== null ? bottlesProduced * targetCapsulesPerBottle : null;
  const rejectCapsules = theoreticalCapsules !== null && capsulesUsed !== null ? theoreticalCapsules - capsulesUsed : null;
  const rejectBottlesFromCapsuleLoss = rejectCapsules !== null && targetCapsulesPerBottle ? rejectCapsules / targetCapsulesPerBottle : null;
  const rejectBottles = bottleUsed !== null && bottlesProduced !== null ? bottleUsed - bottlesProduced : null;
  const rejectDesiccants = desiccantsUsed !== null && bottlesProduced !== null ? desiccantsUsed - bottlesProduced : null;
  const rejectCaps = capsUsed !== null && bottlesProduced !== null ? capsUsed - bottlesProduced : null;

  // Reconciliation -- mirrors the spreadsheet's "Reconciliation" section exactly.
  const capsuleReconciliationPct = capsulesUsed !== null && theoreticalCapsules ? (capsulesUsed / theoreticalCapsules) * 100 : null;
  const capsReconciliationPct = bottlesProduced !== null && capsUsed ? (bottlesProduced / capsUsed) * 100 : null;
  const bottleReconciliationPct = bottlesProduced !== null && bottleUsed ? (bottlesProduced / bottleUsed) * 100 : null;
  const processYieldPct = bottlesProduced !== null && theoreticalBottles ? (bottlesProduced / theoreticalBottles) * 100 : null;
  const rejectionLossPct = rejectCapsules !== null && theoreticalCapsules ? (rejectCapsules / theoreticalCapsules) * 100 : null;

  const checks: ReconciliationCheck[] = [
    checkRange("Capsule Reconciliation", capsuleReconciliationPct, 98, 102),
    checkRange("Caps Reconciliation", capsReconciliationPct, 98, 102),
    checkRange("Bottle Reconciliation", bottleReconciliationPct, 98, 102),
    checkRange("Process Yield", processYieldPct, 95, 102),
    checkBelow("Rejection & Loss", rejectionLossPct, 2),
  ];

  function save() {
    setError("");
    startTransition(async () => {
      try {
        await saveBottling(batchId, {
          totalCapsuleBulkWeightKg: n(form.totalCapsuleBulkWeightKg),
          avgCapsuleFullWeightMg: avgFullWeight,
          plannedQuantityBottles,
          capsuleReceivedKg,
          bottlesProduced,
          bottleUsed,
          desiccantsUsed,
          capsUsed,
          targetCapsulesPerBottle,
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
          <Field label="Total Capsule Bulk Weight (kg)">
            <input type="number" className="input" disabled={!canManage} value={form.totalCapsuleBulkWeightKg} onChange={(e) => set("totalCapsuleBulkWeightKg", e.target.value)} />
          </Field>
          <Field label="Average Capsule Full Weight (mg)">
            <input type="number" className="input" placeholder="e.g. 450 (not 0.45)" disabled={!canManage} value={form.avgCapsuleFullWeightMg} onChange={(e) => set("avgCapsuleFullWeightMg", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Batch Production Data">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field label="Planned Quantity (Bottles)">
            <input type="number" className="input" disabled={!canManage} value={form.plannedQuantityBottles} onChange={(e) => set("plannedQuantityBottles", e.target.value)} />
          </Field>
          <Field label="Target Capsules per Bottle">
            <input type="number" className="input" disabled={!canManage} value={form.targetCapsulesPerBottle} onChange={(e) => set("targetCapsulesPerBottle", e.target.value)} />
          </Field>
          <Field label="Capsule Received (kg)">
            <input type="number" className="input" disabled={!canManage} value={form.capsuleReceivedKg} onChange={(e) => set("capsuleReceivedKg", e.target.value)} />
          </Field>
          <Field label="Bottles Produced">
            <input type="number" className="input" disabled={!canManage} value={form.bottlesProduced} onChange={(e) => set("bottlesProduced", e.target.value)} />
          </Field>
          <Field label="Bottle Used">
            <input type="number" className="input" disabled={!canManage} value={form.bottleUsed} onChange={(e) => set("bottleUsed", e.target.value)} />
          </Field>
          <Field label="Desiccants Used">
            <input type="number" className="input" disabled={!canManage} value={form.desiccantsUsed} onChange={(e) => set("desiccantsUsed", e.target.value)} />
          </Field>
          <Field label="Caps Used">
            <input type="number" className="input" disabled={!canManage} value={form.capsUsed} onChange={(e) => set("capsUsed", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Batch Calculations">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field label="Capsules Required">
            <p className="input flex items-center bg-surface-muted tabular-nums">{formatCount(capsulesRequired)}</p>
          </Field>
          <Field label="Theoretical No. of Capsules">
            <p className="input flex items-center bg-surface-muted tabular-nums">{formatCount(theoreticalCapsules)}</p>
          </Field>
          <Field label="Theoretical Bottles">
            <p className="input flex items-center bg-surface-muted tabular-nums">{formatCount(theoreticalBottles)}</p>
          </Field>
          <Field label="No. of Capsule Used">
            <p className="input flex items-center bg-surface-muted tabular-nums">{formatCount(capsulesUsed)}</p>
          </Field>
          <Field label="No. of Reject Capsules">
            <p className="input flex items-center bg-surface-muted tabular-nums">{formatCount(rejectCapsules)}</p>
          </Field>
          <Field label="Reject Bottles (from capsule loss)">
            <p className="input flex items-center bg-surface-muted tabular-nums">{formatCount(rejectBottlesFromCapsuleLoss)}</p>
          </Field>
          <Field label="Reject Bottles">
            <p className="input flex items-center bg-surface-muted tabular-nums">{formatCount(rejectBottles)}</p>
          </Field>
          <Field label="Reject Desiccants">
            <p className="input flex items-center bg-surface-muted tabular-nums">{formatCount(rejectDesiccants)}</p>
          </Field>
          <Field label="Reject Caps">
            <p className="input flex items-center bg-surface-muted tabular-nums">{formatCount(rejectCaps)}</p>
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
            {pending ? "Saving..." : "Save Bottling"}
          </Button>
        </div>
      )}
    </div>
  );
}
