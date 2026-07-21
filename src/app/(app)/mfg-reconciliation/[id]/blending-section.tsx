"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveBlending } from "@/lib/actions/mfg-reconciliation-actions";
import { computeYieldPct } from "@/lib/mfg-reconciliation-defaults";
import { Button } from "@/components/ui/Button";
import { Field, Section } from "./mfg-batch-detail-client";

export type BlendingData = {
  totalTheoreticalWeightKg: number | null;
  actualWeightKg: number | null;
  blendBatchNumber: string | null;
  powderRemainingKg: number | null;
  blenderResidueKg: number | null;
  sieveLossKg: number | null;
  dustLossKg: number | null;
  spillagesKg: number | null;
  qcSamplesQty: number | null;
  retentionSamplesQty: number | null;
  destroyedMaterialKg: number | null;
  returnedToWarehouseKg: number | null;
  totalBlendProducedKg: number | null;
  blendedByName: string | null;
  blendedAt: string | null;
  remarks: string | null;
};

function num(v: number | null | undefined) {
  return v?.toString() ?? "";
}

export default function BlendingSection({ batchId, data, canManage }: { batchId: string; data: BlendingData | null; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    totalTheoreticalWeightKg: num(data?.totalTheoreticalWeightKg),
    actualWeightKg: num(data?.actualWeightKg),
    blendBatchNumber: data?.blendBatchNumber ?? "",
    powderRemainingKg: num(data?.powderRemainingKg),
    blenderResidueKg: num(data?.blenderResidueKg),
    sieveLossKg: num(data?.sieveLossKg),
    dustLossKg: num(data?.dustLossKg),
    spillagesKg: num(data?.spillagesKg),
    qcSamplesQty: num(data?.qcSamplesQty),
    retentionSamplesQty: num(data?.retentionSamplesQty),
    destroyedMaterialKg: num(data?.destroyedMaterialKg),
    returnedToWarehouseKg: num(data?.returnedToWarehouseKg),
    totalBlendProducedKg: num(data?.totalBlendProducedKg),
    blendedByName: data?.blendedByName ?? "",
    blendedAt: data?.blendedAt?.slice(0, 10) ?? "",
    remarks: data?.remarks ?? "",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const yieldPct = computeYieldPct(form.totalBlendProducedKg === "" ? null : Number(form.totalBlendProducedKg), form.totalTheoreticalWeightKg === "" ? null : Number(form.totalTheoreticalWeightKg));

  function save() {
    setError("");
    startTransition(async () => {
      try {
        await saveBlending(batchId, {
          totalTheoreticalWeightKg: form.totalTheoreticalWeightKg === "" ? null : Number(form.totalTheoreticalWeightKg),
          actualWeightKg: form.actualWeightKg === "" ? null : Number(form.actualWeightKg),
          blendBatchNumber: form.blendBatchNumber || null,
          powderRemainingKg: form.powderRemainingKg === "" ? null : Number(form.powderRemainingKg),
          blenderResidueKg: form.blenderResidueKg === "" ? null : Number(form.blenderResidueKg),
          sieveLossKg: form.sieveLossKg === "" ? null : Number(form.sieveLossKg),
          dustLossKg: form.dustLossKg === "" ? null : Number(form.dustLossKg),
          spillagesKg: form.spillagesKg === "" ? null : Number(form.spillagesKg),
          qcSamplesQty: form.qcSamplesQty === "" ? null : Number(form.qcSamplesQty),
          retentionSamplesQty: form.retentionSamplesQty === "" ? null : Number(form.retentionSamplesQty),
          destroyedMaterialKg: form.destroyedMaterialKg === "" ? null : Number(form.destroyedMaterialKg),
          returnedToWarehouseKg: form.returnedToWarehouseKg === "" ? null : Number(form.returnedToWarehouseKg),
          totalBlendProducedKg: form.totalBlendProducedKg === "" ? null : Number(form.totalBlendProducedKg),
          blendedByName: form.blendedByName || null,
          blendedAt: form.blendedAt || null,
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
      <Section title="Input">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field label="Total Theoretical Weight (kg)">
            <input type="number" className="input" disabled={!canManage} value={form.totalTheoreticalWeightKg} onChange={(e) => set("totalTheoreticalWeightKg", e.target.value)} />
          </Field>
          <Field label="Actual Weight (kg)">
            <input type="number" className="input" disabled={!canManage} value={form.actualWeightKg} onChange={(e) => set("actualWeightKg", e.target.value)} />
          </Field>
          <Field label="Blend Batch Number">
            <input className="input" disabled={!canManage} value={form.blendBatchNumber} onChange={(e) => set("blendBatchNumber", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Reconciliation">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field label="Powder Remaining (kg)">
            <input type="number" className="input" disabled={!canManage} value={form.powderRemainingKg} onChange={(e) => set("powderRemainingKg", e.target.value)} />
          </Field>
          <Field label="Blender Residue (kg)">
            <input type="number" className="input" disabled={!canManage} value={form.blenderResidueKg} onChange={(e) => set("blenderResidueKg", e.target.value)} />
          </Field>
          <Field label="Sieve Loss (kg)">
            <input type="number" className="input" disabled={!canManage} value={form.sieveLossKg} onChange={(e) => set("sieveLossKg", e.target.value)} />
          </Field>
          <Field label="Dust Loss (kg)">
            <input type="number" className="input" disabled={!canManage} value={form.dustLossKg} onChange={(e) => set("dustLossKg", e.target.value)} />
          </Field>
          <Field label="Spillages (kg)">
            <input type="number" className="input" disabled={!canManage} value={form.spillagesKg} onChange={(e) => set("spillagesKg", e.target.value)} />
          </Field>
          <Field label="QC Samples">
            <input type="number" className="input" disabled={!canManage} value={form.qcSamplesQty} onChange={(e) => set("qcSamplesQty", e.target.value)} />
          </Field>
          <Field label="Retention Samples">
            <input type="number" className="input" disabled={!canManage} value={form.retentionSamplesQty} onChange={(e) => set("retentionSamplesQty", e.target.value)} />
          </Field>
          <Field label="Destroyed Material (kg)">
            <input type="number" className="input" disabled={!canManage} value={form.destroyedMaterialKg} onChange={(e) => set("destroyedMaterialKg", e.target.value)} />
          </Field>
          <Field label="Returned to Warehouse (kg)">
            <input type="number" className="input" disabled={!canManage} value={form.returnedToWarehouseKg} onChange={(e) => set("returnedToWarehouseKg", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Output">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field label="Total Blend Produced (kg)">
            <input type="number" className="input" disabled={!canManage} value={form.totalBlendProducedKg} onChange={(e) => set("totalBlendProducedKg", e.target.value)} />
          </Field>
          <Field label="Blend Yield %">
            <p className="input flex items-center bg-surface-muted tabular-nums">{yieldPct !== null ? `${yieldPct.toFixed(1)}%` : "—"}</p>
          </Field>
          <Field label="Blended By">
            <input className="input" disabled={!canManage} value={form.blendedByName} onChange={(e) => set("blendedByName", e.target.value)} />
          </Field>
          <Field label="Blended At">
            <input type="date" className="input" disabled={!canManage} value={form.blendedAt} onChange={(e) => set("blendedAt", e.target.value)} />
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
            {pending ? "Saving..." : "Save Blending"}
          </Button>
        </div>
      )}
    </div>
  );
}
