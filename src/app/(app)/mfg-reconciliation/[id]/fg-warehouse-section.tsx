"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveFinishedGoodsWarehouse } from "@/lib/actions/mfg-reconciliation-actions";
import { Button } from "@/components/ui/Button";
import { Field, Section } from "./mfg-batch-detail-client";

export type FgWarehouseData = {
  finishedGoodsReceived: number | null;
  qaReleased: boolean;
  qaReleasedByName: string | null;
  qaReleasedAt: string | null;
  storageLocation: string | null;
  warehouseBalance: number | null;
  batchNumber: string | null;
  expiryDate: string | null;
  remarks: string | null;
};

function num(v: number | null | undefined) {
  return v?.toString() ?? "";
}

export default function FgWarehouseSection({ batchId, data, canManage }: { batchId: string; data: FgWarehouseData | null; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    finishedGoodsReceived: num(data?.finishedGoodsReceived),
    qaReleased: data?.qaReleased ?? false,
    qaReleasedByName: data?.qaReleasedByName ?? "",
    qaReleasedAt: data?.qaReleasedAt?.slice(0, 10) ?? "",
    storageLocation: data?.storageLocation ?? "",
    warehouseBalance: num(data?.warehouseBalance),
    batchNumber: data?.batchNumber ?? "",
    expiryDate: data?.expiryDate?.slice(0, 10) ?? "",
    remarks: data?.remarks ?? "",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save() {
    setError("");
    startTransition(async () => {
      try {
        await saveFinishedGoodsWarehouse(batchId, {
          finishedGoodsReceived: form.finishedGoodsReceived === "" ? null : Number(form.finishedGoodsReceived),
          qaReleased: form.qaReleased,
          qaReleasedByName: form.qaReleasedByName || null,
          qaReleasedAt: form.qaReleasedAt || null,
          storageLocation: form.storageLocation || null,
          warehouseBalance: form.warehouseBalance === "" ? null : Number(form.warehouseBalance),
          batchNumber: form.batchNumber || null,
          expiryDate: form.expiryDate || null,
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
      <Section title="Finished Goods Warehouse">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field label="Finished Goods Received">
            <input type="number" className="input" disabled={!canManage} value={form.finishedGoodsReceived} onChange={(e) => set("finishedGoodsReceived", e.target.value)} />
          </Field>
          <Field label="QA Released">
            <label className="flex items-center gap-2 py-2">
              <input type="checkbox" disabled={!canManage} checked={form.qaReleased} onChange={(e) => set("qaReleased", e.target.checked)} />
              <span className="text-sm text-foreground">{form.qaReleased ? "Released" : "Not released"}</span>
            </label>
          </Field>
          <Field label="QA Released By">
            <input className="input" disabled={!canManage} value={form.qaReleasedByName} onChange={(e) => set("qaReleasedByName", e.target.value)} />
          </Field>
          <Field label="QA Released At">
            <input type="date" className="input" disabled={!canManage} value={form.qaReleasedAt} onChange={(e) => set("qaReleasedAt", e.target.value)} />
          </Field>
          <Field label="Storage Location">
            <input className="input" disabled={!canManage} value={form.storageLocation} onChange={(e) => set("storageLocation", e.target.value)} />
          </Field>
          <Field label="Warehouse Balance">
            <input type="number" className="input" disabled={!canManage} value={form.warehouseBalance} onChange={(e) => set("warehouseBalance", e.target.value)} />
          </Field>
          <Field label="Batch Number">
            <input className="input" disabled={!canManage} value={form.batchNumber} onChange={(e) => set("batchNumber", e.target.value)} />
          </Field>
          <Field label="Expiry Date">
            <input type="date" className="input" disabled={!canManage} value={form.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} />
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
            {pending ? "Saving..." : "Save Finished Goods Warehouse"}
          </Button>
        </div>
      )}
    </div>
  );
}
