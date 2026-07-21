"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveXrayInspection } from "@/lib/actions/mfg-reconciliation-actions";
import { Button } from "@/components/ui/Button";
import { Field, Section } from "./mfg-batch-detail-client";

export type XrayData = {
  bottlesReceived: number | null;
  bottlesScanned: number | null;
  passed: number | null;
  failed: number | null;
  reworked: number | null;
  destroyed: number | null;
  released: number | null;
  rejectMetalDetection: number | null;
  rejectXrayFailure: number | null;
  rejectUnderweight: number | null;
  rejectOverweight: number | null;
  rejectDamagedBottle: number | null;
  rejectMissingCap: number | null;
  rejectMissingDesiccant: number | null;
  inspectedByName: string | null;
  inspectedAt: string | null;
  remarks: string | null;
};

function num(v: number | null | undefined) {
  return v?.toString() ?? "";
}

export default function XraySection({ batchId, data, canManage }: { batchId: string; data: XrayData | null; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    bottlesReceived: num(data?.bottlesReceived),
    bottlesScanned: num(data?.bottlesScanned),
    passed: num(data?.passed),
    failed: num(data?.failed),
    reworked: num(data?.reworked),
    destroyed: num(data?.destroyed),
    released: num(data?.released),
    rejectMetalDetection: num(data?.rejectMetalDetection),
    rejectXrayFailure: num(data?.rejectXrayFailure),
    rejectUnderweight: num(data?.rejectUnderweight),
    rejectOverweight: num(data?.rejectOverweight),
    rejectDamagedBottle: num(data?.rejectDamagedBottle),
    rejectMissingCap: num(data?.rejectMissingCap),
    rejectMissingDesiccant: num(data?.rejectMissingDesiccant),
    inspectedByName: data?.inspectedByName ?? "",
    inspectedAt: data?.inspectedAt?.slice(0, 10) ?? "",
    remarks: data?.remarks ?? "",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save() {
    setError("");
    startTransition(async () => {
      try {
        await saveXrayInspection(batchId, {
          bottlesReceived: form.bottlesReceived === "" ? null : Number(form.bottlesReceived),
          bottlesScanned: form.bottlesScanned === "" ? null : Number(form.bottlesScanned),
          passed: form.passed === "" ? null : Number(form.passed),
          failed: form.failed === "" ? null : Number(form.failed),
          reworked: form.reworked === "" ? null : Number(form.reworked),
          destroyed: form.destroyed === "" ? null : Number(form.destroyed),
          released: form.released === "" ? null : Number(form.released),
          rejectMetalDetection: form.rejectMetalDetection === "" ? null : Number(form.rejectMetalDetection),
          rejectXrayFailure: form.rejectXrayFailure === "" ? null : Number(form.rejectXrayFailure),
          rejectUnderweight: form.rejectUnderweight === "" ? null : Number(form.rejectUnderweight),
          rejectOverweight: form.rejectOverweight === "" ? null : Number(form.rejectOverweight),
          rejectDamagedBottle: form.rejectDamagedBottle === "" ? null : Number(form.rejectDamagedBottle),
          rejectMissingCap: form.rejectMissingCap === "" ? null : Number(form.rejectMissingCap),
          rejectMissingDesiccant: form.rejectMissingDesiccant === "" ? null : Number(form.rejectMissingDesiccant),
          inspectedByName: form.inspectedByName || null,
          inspectedAt: form.inspectedAt || null,
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
      <Section title="Inspection">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <Field label="Bottles Received">
            <input type="number" className="input" disabled={!canManage} value={form.bottlesReceived} onChange={(e) => set("bottlesReceived", e.target.value)} />
          </Field>
          <Field label="Bottles Scanned">
            <input type="number" className="input" disabled={!canManage} value={form.bottlesScanned} onChange={(e) => set("bottlesScanned", e.target.value)} />
          </Field>
          <Field label="Passed">
            <input type="number" className="input" disabled={!canManage} value={form.passed} onChange={(e) => set("passed", e.target.value)} />
          </Field>
          <Field label="Failed">
            <input type="number" className="input" disabled={!canManage} value={form.failed} onChange={(e) => set("failed", e.target.value)} />
          </Field>
          <Field label="Reworked">
            <input type="number" className="input" disabled={!canManage} value={form.reworked} onChange={(e) => set("reworked", e.target.value)} />
          </Field>
          <Field label="Destroyed">
            <input type="number" className="input" disabled={!canManage} value={form.destroyed} onChange={(e) => set("destroyed", e.target.value)} />
          </Field>
          <Field label="Released">
            <input type="number" className="input" disabled={!canManage} value={form.released} onChange={(e) => set("released", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Reject Reasons">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <Field label="Metal Detection">
            <input type="number" className="input" disabled={!canManage} value={form.rejectMetalDetection} onChange={(e) => set("rejectMetalDetection", e.target.value)} />
          </Field>
          <Field label="X-Ray Failure">
            <input type="number" className="input" disabled={!canManage} value={form.rejectXrayFailure} onChange={(e) => set("rejectXrayFailure", e.target.value)} />
          </Field>
          <Field label="Underweight">
            <input type="number" className="input" disabled={!canManage} value={form.rejectUnderweight} onChange={(e) => set("rejectUnderweight", e.target.value)} />
          </Field>
          <Field label="Overweight">
            <input type="number" className="input" disabled={!canManage} value={form.rejectOverweight} onChange={(e) => set("rejectOverweight", e.target.value)} />
          </Field>
          <Field label="Damaged Bottle">
            <input type="number" className="input" disabled={!canManage} value={form.rejectDamagedBottle} onChange={(e) => set("rejectDamagedBottle", e.target.value)} />
          </Field>
          <Field label="Missing Cap">
            <input type="number" className="input" disabled={!canManage} value={form.rejectMissingCap} onChange={(e) => set("rejectMissingCap", e.target.value)} />
          </Field>
          <Field label="Missing Desiccant">
            <input type="number" className="input" disabled={!canManage} value={form.rejectMissingDesiccant} onChange={(e) => set("rejectMissingDesiccant", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Sign-off">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field label="Inspected By">
            <input className="input" disabled={!canManage} value={form.inspectedByName} onChange={(e) => set("inspectedByName", e.target.value)} />
          </Field>
          <Field label="Inspected At">
            <input type="date" className="input" disabled={!canManage} value={form.inspectedAt} onChange={(e) => set("inspectedAt", e.target.value)} />
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
            {pending ? "Saving..." : "Save X-Ray / Metal Detection"}
          </Button>
        </div>
      )}
    </div>
  );
}
