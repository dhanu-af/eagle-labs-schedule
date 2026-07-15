"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CheckStatus } from "@/generated/prisma";
import {
  saveBatchRecord,
  lockBatchRecord,
  unlockBatchRecord,
  type BatchHeaderInput,
  type WorkLogEntryInput,
  type OperatorSignoffInput,
  type EquipmentItemInput,
  type LineClearanceInput,
  type MixUpdateInput,
  type WarehouseReturnLineInput,
  type MaterialRequestLineInput,
} from "@/lib/actions/batch-record-actions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Th, THEAD_ROW_CLASS } from "@/components/ui/Th";
import { STATUS_BADGE } from "../../checks/status-badge";

type DispensingLine = {
  id: string;
  rmNumber: string | null;
  ingredientName: string;
  uin: string | null;
  requiredQtyKg: number;
  actualQtyDispensedKg: number | null;
  performedBySign: string | null;
  performedByDate: string | null;
  verifiedBySign: string | null;
  verifiedByDate: string | null;
};

type Drum = { id: string; drumNumber: string | null; netWeightKg: number | null; passLabelAttached: boolean };

type Mix = {
  id: string;
  mixNumber: number;
  dispensingStartDate: string | null;
  dispensingStartTime: string | null;
  dispensingStartSign: string | null;
  dispensingEndDate: string | null;
  dispensingEndTime: string | null;
  dispensingEndSign: string | null;
  blendingStartDate: string | null;
  blendingStartTime: string | null;
  blendingStartSign: string | null;
  blendingEndDate: string | null;
  blendingEndTime: string | null;
  blendingEndSign: string | null;
  mixCompletedSign: string | null;
  mixCompletedDate: string | null;
  mixCompletedTime: string | null;
  verifiedBySign: string | null;
  verifiedByDate: string | null;
  verifiedByTime: string | null;
  samplesRejectsSpillsKg: number | null;
  bulkSampleWeightG: number | null;
  bulkVolumeMl: number | null;
  tappedVolumeMl: number | null;
  dispensingLines: DispensingLine[];
  drums: Drum[];
};

type Batch = {
  id: string;
  productName: string;
  batchNumber: string;
  numberOfMixes: number;
  batchSizePerMix: number;
  batchSizeUnit: string;
  status: CheckStatus;
  locked: boolean;
  writtenByName: string | null;
  writtenSignedDate: string | null;
  checkedByName: string | null;
  checkedSignedDate: string | null;
  reviewDate: string | null;
  notes: string | null;
  declEncapsulation: boolean;
  declBlendingMixing: boolean;
  declDispensing: boolean;
  declPolishing: boolean;
  declCoating: boolean;
  releasedByWarehouse: string | null;
  releasedDate: string | null;
  requestCheckedBy: string | null;
  ailsNumber: string | null;
  palletNumber: string | null;
  workLogEntries: { id: string; date: string | null; operatorName: string | null; processNumber: number | null; startTime: string | null; finishTime: string | null; breakMinutes: number | null; totalHours: number | null; sign: string | null }[];
  operators: { id: string; name: string | null; signature: string | null; date: string | null }[];
  equipment: { id: string; eqNumber: string | null; itemName: string | null; calibrationUpdated: string | null; notes: string | null }[];
  lineClearance: {
    roomNumber: string | null;
    roomCleanType: string | null;
    equipmentCleanType: string | null;
    performedBySign: string | null;
    performedByDate: string | null;
    performedByTime: string | null;
    verifiedBySign: string | null;
    verifiedByDate: string | null;
    verifiedByTime: string | null;
    probioticProduct: boolean;
    roomRhPercent: number | null;
    roomRhTime: string | null;
    roomTemperature: number | null;
    roomTempTime: string | null;
    roomUseApprovalSign: string | null;
    roomUseApprovalDate: string | null;
    materialsIdentifiedChecked: boolean;
    materialsPassLabelledChecked: boolean;
  } | null;
  mixes: Mix[];
  warehouseReturns: { id: string; rmNumber: string | null; ingredientName: string; uin: string | null; kgPerBatch: number | null; qtyUsedKg: number | null; actualQtyReturnedKg: number | null; operatorSign: string | null; operatorDate: string | null }[];
  materialRequests: { id: string; rmNumber: string | null; ingredientName: string; uin: string | null; kgPerBatch: number | null; qtyReleasedKg: number | null; actualQtyReceivedKg: number | null; operatorSign: string | null; operatorDate: string | null }[];
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function num(v: string): number | undefined {
  if (v === "") return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

const PROCESS_LEGEND = [
  "1 Dispensing", "2 Blending", "3 Polishing", "4 Coating", "5 Rework", "6 Cleaning", "7 Breakdown", "8 Other",
];

const HEALTH_AND_SAFETY = [
  "Operators are responsible for all quality checks in this document and ensuring that correct batch document practices are followed.",
  "ALL personnel are responsible for the quality of ALL products manufactured.",
  "All personnel must ensure they have been trained in the applicable procedures before continuing with their issued work order.",
  "Report any reactions to chemicals to your supervisor immediately.",
  "Raise any concerns to your supervisor or manager.",
  "Wear safety glasses, gloves, dust masks, ear protection, safety footwear and protective gowning at all times when handling chemicals, raw materials and working on machinery.",
  "Ensure correct safety and setup checks, maintenance, calibration, safety switches and guards are in correct working order before use.",
  "No personal items (jewellery, phones, electronic/music devices, perfumes, cosmetics, food, drinks, chewing gum, loose items) are permitted in the production area — store in designated lockers before entry.",
];

const BLENDING_INSTRUCTIONS = [
  "Verify that the blender and all associated equipment are clean, dry, sanitised, and released for use.",
  "Inspect the blender prior to use: rubber seals clean, bin valve tightly closed, bin lid properly fitted and securely locked.",
  "Ensure all raw materials have been weighed, identified, and approved according to the BMR. Sieve silica and magnesium stearate as fine as possible before use.",
  "Visually inspect all powders and confirm they are free from lumps or clumps prior to charging into the blender. Sieve if required. Report any abnormality to the Supervisor and obtain approval before proceeding.",
  "Load all powders (except magnesium stearate) into the blender. Securely close the lid, ensure guards and safety devices are in place.",
  "Start the blender and set the blending time to 20 minutes. Ensure all doors are closed and exit the room.",
  "After 20 minutes, stop the blender and add the required quantity of magnesium stearate. Restart and mix for a further 5 minutes only.",
  "After a total blending time of 25 minutes, stop the blender and inspect the blend for uniformity and powder consistency.",
  "Before discharging: perform blend uniformity testing as required and obtain Supervisor approval before proceeding.",
  "Dispense materials into clean, dry, sanitised, labelled containers. Record the actual weight as displayed on the scale.",
  "Transfer the blend into clean, sanitised Bulk Product Storage Drums (internal surfaces and lids sanitised prior to use).",
  "Collect one (01) representative sample (~50 g) from each blend using a clean white sample bottle and submit it to QA.",
  "Complete all required GMP documentation, including blend times, weights, sampling records, and operator signatures.",
  "Return all excess raw materials to the warehouse and store in designated locations. Clean the blender and equipment per the approved cleaning procedure.",
  "Leave the blending room clean, tidy, and ready for the next production batch.",
];

export default function BatchRecordClient({ canEdit, canLock, currentUserName, batch }: { canEdit: boolean; canLock: boolean; currentUserName: string; batch: Batch }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [header, setHeader] = useState<BatchHeaderInput>({
    writtenByName: batch.writtenByName ?? "",
    writtenSignedDate: batch.writtenSignedDate ?? "",
    checkedByName: batch.checkedByName ?? "",
    checkedSignedDate: batch.checkedSignedDate ?? "",
    reviewDate: batch.reviewDate ?? "",
    notes: batch.notes ?? "",
    declEncapsulation: batch.declEncapsulation,
    declBlendingMixing: batch.declBlendingMixing,
    declDispensing: batch.declDispensing,
    declPolishing: batch.declPolishing,
    declCoating: batch.declCoating,
    releasedByWarehouse: batch.releasedByWarehouse ?? "",
    releasedDate: batch.releasedDate ?? "",
    requestCheckedBy: batch.requestCheckedBy ?? "",
    ailsNumber: batch.ailsNumber ?? "",
    palletNumber: batch.palletNumber ?? "",
  });

  const [workLogEntries, setWorkLogEntries] = useState<WorkLogEntryInput[]>(
    batch.workLogEntries.length
      ? batch.workLogEntries.map((w) => ({ date: w.date ?? "", operatorName: w.operatorName ?? "", processNumber: w.processNumber ?? undefined, startTime: w.startTime ?? "", finishTime: w.finishTime ?? "", breakMinutes: w.breakMinutes ?? undefined, totalHours: w.totalHours ?? undefined, sign: w.sign ?? "" }))
      : Array.from({ length: 5 }, () => ({}))
  );

  const [operators, setOperators] = useState<OperatorSignoffInput[]>(
    batch.operators.length ? batch.operators.map((o) => ({ name: o.name ?? "", signature: o.signature ?? "", date: o.date ?? "" })) : Array.from({ length: 3 }, () => ({}))
  );

  const [equipment, setEquipment] = useState<EquipmentItemInput[]>(
    batch.equipment.length ? batch.equipment.map((e) => ({ eqNumber: e.eqNumber ?? "", itemName: e.itemName ?? "", calibrationUpdated: e.calibrationUpdated ?? "", notes: e.notes ?? "" })) : Array.from({ length: 3 }, () => ({}))
  );

  const [lineClearance, setLineClearance] = useState<LineClearanceInput>(
    batch.lineClearance
      ? {
          roomNumber: batch.lineClearance.roomNumber ?? "",
          roomCleanType: batch.lineClearance.roomCleanType ?? "",
          equipmentCleanType: batch.lineClearance.equipmentCleanType ?? "",
          performedBySign: batch.lineClearance.performedBySign ?? "",
          performedByDate: batch.lineClearance.performedByDate ?? "",
          performedByTime: batch.lineClearance.performedByTime ?? "",
          verifiedBySign: batch.lineClearance.verifiedBySign ?? "",
          verifiedByDate: batch.lineClearance.verifiedByDate ?? "",
          verifiedByTime: batch.lineClearance.verifiedByTime ?? "",
          probioticProduct: batch.lineClearance.probioticProduct,
          roomRhPercent: batch.lineClearance.roomRhPercent ?? undefined,
          roomRhTime: batch.lineClearance.roomRhTime ?? "",
          roomTemperature: batch.lineClearance.roomTemperature ?? undefined,
          roomTempTime: batch.lineClearance.roomTempTime ?? "",
          roomUseApprovalSign: batch.lineClearance.roomUseApprovalSign ?? "",
          roomUseApprovalDate: batch.lineClearance.roomUseApprovalDate ?? "",
          materialsIdentifiedChecked: batch.lineClearance.materialsIdentifiedChecked,
          materialsPassLabelledChecked: batch.lineClearance.materialsPassLabelledChecked,
        }
      : { probioticProduct: false, materialsIdentifiedChecked: false, materialsPassLabelledChecked: false }
  );

  const [mixes, setMixes] = useState<Record<string, MixUpdateInput>>(
    Object.fromEntries(
      batch.mixes.map((m) => [
        m.id,
        {
          dispensingStartDate: m.dispensingStartDate ?? "",
          dispensingStartTime: m.dispensingStartTime ?? "",
          dispensingStartSign: m.dispensingStartSign ?? "",
          dispensingEndDate: m.dispensingEndDate ?? "",
          dispensingEndTime: m.dispensingEndTime ?? "",
          dispensingEndSign: m.dispensingEndSign ?? "",
          blendingStartDate: m.blendingStartDate ?? "",
          blendingStartTime: m.blendingStartTime ?? "",
          blendingStartSign: m.blendingStartSign ?? "",
          blendingEndDate: m.blendingEndDate ?? "",
          blendingEndTime: m.blendingEndTime ?? "",
          blendingEndSign: m.blendingEndSign ?? "",
          mixCompletedSign: m.mixCompletedSign ?? "",
          mixCompletedDate: m.mixCompletedDate ?? "",
          mixCompletedTime: m.mixCompletedTime ?? "",
          verifiedBySign: m.verifiedBySign ?? "",
          verifiedByDate: m.verifiedByDate ?? "",
          verifiedByTime: m.verifiedByTime ?? "",
          samplesRejectsSpillsKg: m.samplesRejectsSpillsKg ?? undefined,
          bulkSampleWeightG: m.bulkSampleWeightG ?? undefined,
          bulkVolumeMl: m.bulkVolumeMl ?? undefined,
          tappedVolumeMl: m.tappedVolumeMl ?? undefined,
          dispensingLines: m.dispensingLines.map((l) => ({
            id: l.id,
            actualQtyDispensedKg: l.actualQtyDispensedKg ?? undefined,
            performedBySign: l.performedBySign ?? "",
            performedByDate: l.performedByDate ?? "",
            verifiedBySign: l.verifiedBySign ?? "",
            verifiedByDate: l.verifiedByDate ?? "",
          })),
          drums: m.drums.length
            ? m.drums.map((d) => ({ drumNumber: d.drumNumber ?? "", netWeightKg: d.netWeightKg ?? undefined, passLabelAttached: d.passLabelAttached }))
            : Array.from({ length: 4 }, () => ({ passLabelAttached: false })),
        },
      ])
    )
  );

  const [warehouseReturns, setWarehouseReturns] = useState<Record<string, WarehouseReturnLineInput>>(
    Object.fromEntries(batch.warehouseReturns.map((w) => [w.id, { actualQtyReturnedKg: w.actualQtyReturnedKg ?? undefined, operatorSign: w.operatorSign ?? "", operatorDate: w.operatorDate ?? "" }]))
  );

  const [materialRequests, setMaterialRequests] = useState<Record<string, MaterialRequestLineInput>>(
    Object.fromEntries(batch.materialRequests.map((m) => [m.id, { actualQtyReceivedKg: m.actualQtyReceivedKg ?? undefined, operatorSign: m.operatorSign ?? "", operatorDate: m.operatorDate ?? "" }]))
  );

  const reconciliation = useMemo(() => {
    return Object.fromEntries(
      batch.mixes.map((m) => {
        const mixState = mixes[m.id];
        const A = mixState.dispensingLines.reduce((s, l) => {
          const original = m.dispensingLines.find((x) => x.id === l.id);
          return s + (l.actualQtyDispensedKg ?? original?.requiredQtyKg ?? 0);
        }, 0);
        const B = mixState.drums.reduce((s, d) => s + (d.netWeightKg ?? 0), 0);
        const yieldPct = A > 0 && B > 0 ? (B / A) * 100 : null;
        const bulkDensity = mixState.bulkSampleWeightG && mixState.bulkVolumeMl ? mixState.bulkSampleWeightG / mixState.bulkVolumeMl : null;
        const tappedDensity = mixState.bulkSampleWeightG && mixState.tappedVolumeMl ? mixState.bulkSampleWeightG / mixState.tappedVolumeMl : null;
        return [m.id, { A, B, yieldPct, bulkDensity, tappedDensity }];
      })
    );
  }, [batch.mixes, mixes]);

  const totalBatchSize = batch.numberOfMixes * batch.batchSizePerMix;

  function save() {
    setError("");
    startTransition(async () => {
      try {
        await saveBatchRecord(batch.id, { header, workLogEntries, operators, equipment, lineClearance, mixes, warehouseReturns, materialRequests });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save.");
      }
    });
  }

  function lock() {
    if (!confirm("Approve and lock this Batch Manufacturing Record? It can only be unlocked by a Supervisor or Super Admin afterwards.")) return;
    startTransition(async () => {
      await lockBatchRecord(batch.id);
      router.refresh();
    });
  }

  function unlock() {
    startTransition(async () => {
      await unlockBatchRecord(batch.id);
      router.refresh();
    });
  }

  function downloadPdf() {
    window.open(`/api/batch-records/${batch.id}/pdf`, "_blank");
  }

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        title={`${batch.productName} — Batch ${batch.batchNumber}`}
        subtitle={`${batch.numberOfMixes} mix${batch.numberOfMixes > 1 ? "es" : ""} × ${batch.batchSizePerMix.toFixed(2)} ${batch.batchSizeUnit} = ${totalBatchSize.toFixed(2)} ${batch.batchSizeUnit} total`}
        actions={
          <div className="flex items-center gap-2">
            {STATUS_BADGE[batch.status]}
            <Button variant="secondary" onClick={downloadPdf}>
              Download PDF
            </Button>
            {canEdit && (
              <Button onClick={save} disabled={pending}>
                {pending ? "Saving..." : "Save"}
              </Button>
            )}
            {canLock && !batch.locked && (
              <Button variant="secondary" onClick={lock} disabled={pending}>
                Approve & Lock
              </Button>
            )}
            {canLock && batch.locked && (
              <Button variant="secondary" onClick={unlock} disabled={pending}>
                Unlock
              </Button>
            )}
          </div>
        }
      />
      {batch.locked && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-xs text-primary">
          This record is approved and locked. A Supervisor or Super Admin can unlock it to allow further edits.
        </div>
      )}
      {error && <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-xs text-danger">{error}</div>}

      {/* Header sign-off */}
      <Card>
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">Work Log &amp; Sign-off</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Written by">
            <input disabled={!canEdit} value={header.writtenByName} onChange={(e) => setHeader({ ...header, writtenByName: e.target.value })} className="input" placeholder={currentUserName} />
          </Field>
          <Field label="Written — Sign/Date">
            <input disabled={!canEdit} type="date" value={header.writtenSignedDate} onChange={(e) => setHeader({ ...header, writtenSignedDate: e.target.value })} className="input" />
          </Field>
          <Field label="Review date">
            <input disabled={!canEdit} type="date" value={header.reviewDate} onChange={(e) => setHeader({ ...header, reviewDate: e.target.value })} className="input" />
          </Field>
          <Field label="Checked & authorised by (QA)">
            <input disabled={!canEdit} value={header.checkedByName} onChange={(e) => setHeader({ ...header, checkedByName: e.target.value })} className="input" />
          </Field>
          <Field label="Checked — Sign/Date">
            <input disabled={!canEdit} type="date" value={header.checkedSignedDate} onChange={(e) => setHeader({ ...header, checkedSignedDate: e.target.value })} className="input" />
          </Field>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className={THEAD_ROW_CLASS}>
                <Th>#</Th><Th>Date</Th><Th>Operator</Th><Th>Process #</Th><Th>Start</Th><Th>Finish</Th><Th>Break (min)</Th><Th>Total Hours</Th><Th>Sign</Th>
              </tr>
            </thead>
            <tbody>
              {workLogEntries.map((w, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                  <td className="px-2 py-1"><input disabled={!canEdit} type="date" value={w.date ?? ""} onChange={(e) => setWorkLogEntries(workLogEntries.map((x, xi) => (xi === i ? { ...x, date: e.target.value } : x)))} className="input" /></td>
                  <td className="px-2 py-1"><input disabled={!canEdit} value={w.operatorName ?? ""} onChange={(e) => setWorkLogEntries(workLogEntries.map((x, xi) => (xi === i ? { ...x, operatorName: e.target.value } : x)))} className="input" /></td>
                  <td className="px-2 py-1"><input disabled={!canEdit} type="number" min={1} max={8} value={w.processNumber ?? ""} onChange={(e) => setWorkLogEntries(workLogEntries.map((x, xi) => (xi === i ? { ...x, processNumber: num(e.target.value) } : x)))} className="input w-16" /></td>
                  <td className="px-2 py-1"><input disabled={!canEdit} type="time" value={w.startTime ?? ""} onChange={(e) => setWorkLogEntries(workLogEntries.map((x, xi) => (xi === i ? { ...x, startTime: e.target.value } : x)))} className="input" /></td>
                  <td className="px-2 py-1"><input disabled={!canEdit} type="time" value={w.finishTime ?? ""} onChange={(e) => setWorkLogEntries(workLogEntries.map((x, xi) => (xi === i ? { ...x, finishTime: e.target.value } : x)))} className="input" /></td>
                  <td className="px-2 py-1"><input disabled={!canEdit} type="number" value={w.breakMinutes ?? ""} onChange={(e) => setWorkLogEntries(workLogEntries.map((x, xi) => (xi === i ? { ...x, breakMinutes: num(e.target.value) } : x)))} className="input w-20" /></td>
                  <td className="px-2 py-1"><input disabled={!canEdit} type="number" step="0.01" value={w.totalHours ?? ""} onChange={(e) => setWorkLogEntries(workLogEntries.map((x, xi) => (xi === i ? { ...x, totalHours: num(e.target.value) } : x)))} className="input w-20" /></td>
                  <td className="px-2 py-1"><input disabled={!canEdit} value={w.sign ?? ""} onChange={(e) => setWorkLogEntries(workLogEntries.map((x, xi) => (xi === i ? { ...x, sign: e.target.value } : x)))} className="input" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {canEdit && (
            <div className="mt-2 flex gap-3">
              <button onClick={() => setWorkLogEntries([...workLogEntries, {}])} className="text-xs font-medium text-primary hover:underline">+ Add row</button>
              {workLogEntries.length > 1 && <button onClick={() => setWorkLogEntries(workLogEntries.slice(0, -1))} className="text-xs font-medium text-danger hover:opacity-80">Remove last row</button>}
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">* Production Process: {PROCESS_LEGEND.join(" · ")}</p>

        <Field label="Notes / Comments / Deviations">
          <textarea disabled={!canEdit} rows={3} value={header.notes} onChange={(e) => setHeader({ ...header, notes: e.target.value })} className="input mt-3" />
        </Field>
      </Card>

      {/* Health & Safety (static) */}
      <Card>
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">Health &amp; Safety Guidelines</h2>
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          {HEALTH_AND_SAFETY.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      </Card>

      {/* Operators' Declaration + Equipment */}
      <Card>
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">Operators&apos; Declaration</h2>
        <p className="mb-3 text-xs text-muted-foreground">I read and understood the Health and Safety Guidelines and have been trained in the manufacturing/processing steps below.</p>
        <div className="flex flex-wrap gap-4">
          {([
            ["declEncapsulation", "Encapsulation"],
            ["declBlendingMixing", "Blending/Mixing"],
            ["declDispensing", "Dispensing"],
            ["declPolishing", "Polishing"],
            ["declCoating", "Coating"],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={header[key]}
                onChange={(e) => setHeader({ ...header, [key]: e.target.checked })}
                className="h-4 w-4 rounded accent-primary"
              />
              {label}
            </label>
          ))}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead><tr className={THEAD_ROW_CLASS}><Th>#</Th><Th>Name</Th><Th>Signature</Th><Th>Date</Th></tr></thead>
            <tbody>
              {operators.map((o, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                  <td className="px-2 py-1"><input disabled={!canEdit} value={o.name ?? ""} onChange={(e) => setOperators(operators.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)))} className="input" /></td>
                  <td className="px-2 py-1"><input disabled={!canEdit} value={o.signature ?? ""} onChange={(e) => setOperators(operators.map((x, xi) => (xi === i ? { ...x, signature: e.target.value } : x)))} className="input" /></td>
                  <td className="px-2 py-1"><input disabled={!canEdit} type="date" value={o.date ?? ""} onChange={(e) => setOperators(operators.map((x, xi) => (xi === i ? { ...x, date: e.target.value } : x)))} className="input" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {canEdit && (
            <div className="mt-2 flex gap-3">
              <button onClick={() => setOperators([...operators, {}])} className="text-xs font-medium text-primary hover:underline">+ Add operator</button>
              {operators.length > 1 && <button onClick={() => setOperators(operators.slice(0, -1))} className="text-xs font-medium text-danger hover:opacity-80">Remove last</button>}
            </div>
          )}
        </div>

        <h3 className="mb-2 mt-5 text-sm font-semibold text-foreground">Equipment Record</h3>
        <p className="mb-2 text-xs text-muted-foreground">Record ALL equipment, auxiliaries, scales used (e.g. V Blenders, Weighing scales, Screen mesh/size).</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead><tr className={THEAD_ROW_CLASS}><Th>EQ No.</Th><Th>Item Name</Th><Th>Calibration Updated</Th><Th>Notes</Th></tr></thead>
            <tbody>
              {equipment.map((e, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-2 py-1"><input disabled={!canEdit} value={e.eqNumber ?? ""} onChange={(ev) => setEquipment(equipment.map((x, xi) => (xi === i ? { ...x, eqNumber: ev.target.value } : x)))} className="input" /></td>
                  <td className="px-2 py-1"><input disabled={!canEdit} value={e.itemName ?? ""} onChange={(ev) => setEquipment(equipment.map((x, xi) => (xi === i ? { ...x, itemName: ev.target.value } : x)))} className="input" /></td>
                  <td className="px-2 py-1">
                    <select disabled={!canEdit} value={e.calibrationUpdated ?? ""} onChange={(ev) => setEquipment(equipment.map((x, xi) => (xi === i ? { ...x, calibrationUpdated: ev.target.value } : x)))} className="input">
                      <option value="">—</option><option value="YES">Yes</option><option value="NO">No</option><option value="N/A">N/A</option>
                    </select>
                  </td>
                  <td className="px-2 py-1"><input disabled={!canEdit} value={e.notes ?? ""} onChange={(ev) => setEquipment(equipment.map((x, xi) => (xi === i ? { ...x, notes: ev.target.value } : x)))} className="input" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {canEdit && (
            <div className="mt-2 flex gap-3">
              <button onClick={() => setEquipment([...equipment, {}])} className="text-xs font-medium text-primary hover:underline">+ Add equipment</button>
              {equipment.length > 1 && <button onClick={() => setEquipment(equipment.slice(0, -1))} className="text-xs font-medium text-danger hover:opacity-80">Remove last</button>}
            </div>
          )}
        </div>
      </Card>

      {/* Line Clearance */}
      <Card>
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">Line Clearance Checklist</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Room No."><input disabled={!canEdit} value={lineClearance.roomNumber ?? ""} onChange={(e) => setLineClearance({ ...lineClearance, roomNumber: e.target.value })} className="input" /></Field>
          <Field label="Type of ROOM clean">
            <select disabled={!canEdit} value={lineClearance.roomCleanType ?? ""} onChange={(e) => setLineClearance({ ...lineClearance, roomCleanType: e.target.value })} className="input">
              <option value="">—</option><option value="FULL">Full</option><option value="PROVISIONAL">Provisional</option>
            </select>
          </Field>
          <Field label="Type of EQUIPMENT clean">
            <select disabled={!canEdit} value={lineClearance.equipmentCleanType ?? ""} onChange={(e) => setLineClearance({ ...lineClearance, equipmentCleanType: e.target.value })} className="input">
              <option value="">—</option><option value="FULL">Full</option><option value="PROVISIONAL">Provisional</option>
            </select>
          </Field>
          <Field label="Performed by (Sign)"><input disabled={!canEdit} value={lineClearance.performedBySign ?? ""} onChange={(e) => setLineClearance({ ...lineClearance, performedBySign: e.target.value })} className="input" /></Field>
          <Field label="Performed — Date"><input disabled={!canEdit} type="date" value={lineClearance.performedByDate ?? ""} onChange={(e) => setLineClearance({ ...lineClearance, performedByDate: e.target.value })} className="input" /></Field>
          <Field label="Performed — Time"><input disabled={!canEdit} type="time" value={lineClearance.performedByTime ?? ""} onChange={(e) => setLineClearance({ ...lineClearance, performedByTime: e.target.value })} className="input" /></Field>
          <Field label="Verified by Blending Supervisor (Sign)"><input disabled={!canEdit} value={lineClearance.verifiedBySign ?? ""} onChange={(e) => setLineClearance({ ...lineClearance, verifiedBySign: e.target.value })} className="input" /></Field>
          <Field label="Verified — Date"><input disabled={!canEdit} type="date" value={lineClearance.verifiedByDate ?? ""} onChange={(e) => setLineClearance({ ...lineClearance, verifiedByDate: e.target.value })} className="input" /></Field>
          <Field label="Verified — Time"><input disabled={!canEdit} type="time" value={lineClearance.verifiedByTime ?? ""} onChange={(e) => setLineClearance({ ...lineClearance, verifiedByTime: e.target.value })} className="input" /></Field>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" disabled={!canEdit} checked={lineClearance.probioticProduct} onChange={(e) => setLineClearance({ ...lineClearance, probioticProduct: e.target.checked })} className="h-4 w-4 rounded accent-primary" />Probiotic product/materials</label>
          <Field label="Room %RH (NMT 55%)"><input disabled={!canEdit} type="number" step="0.1" value={lineClearance.roomRhPercent ?? ""} onChange={(e) => setLineClearance({ ...lineClearance, roomRhPercent: num(e.target.value) })} className="input" /></Field>
          <Field label="RH Time"><input disabled={!canEdit} type="time" value={lineClearance.roomRhTime ?? ""} onChange={(e) => setLineClearance({ ...lineClearance, roomRhTime: e.target.value })} className="input" /></Field>
          <Field label="Room Temp °C (NMT 25°C)"><input disabled={!canEdit} type="number" step="0.1" value={lineClearance.roomTemperature ?? ""} onChange={(e) => setLineClearance({ ...lineClearance, roomTemperature: num(e.target.value) })} className="input" /></Field>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Room Use Approval (Sign)"><input disabled={!canEdit} value={lineClearance.roomUseApprovalSign ?? ""} onChange={(e) => setLineClearance({ ...lineClearance, roomUseApprovalSign: e.target.value })} className="input" /></Field>
          <Field label="Room Use Approval — Date"><input disabled={!canEdit} type="date" value={lineClearance.roomUseApprovalDate ?? ""} onChange={(e) => setLineClearance({ ...lineClearance, roomUseApprovalDate: e.target.value })} className="input" /></Field>
        </div>

        <div className="mt-3 space-y-1.5">
          <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" disabled={!canEdit} checked={lineClearance.materialsIdentifiedChecked} onChange={(e) => setLineClearance({ ...lineClearance, materialsIdentifiedChecked: e.target.checked })} className="h-4 w-4 rounded accent-primary" />All materials on the pallet are identified for the correct Product Code and Batch No.</label>
          <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" disabled={!canEdit} checked={lineClearance.materialsPassLabelledChecked} onChange={(e) => setLineClearance({ ...lineClearance, materialsPassLabelledChecked: e.target.checked })} className="h-4 w-4 rounded accent-primary" />All materials received have been tagged with PASS labels by Warehouse.</label>
        </div>
      </Card>

      {/* Dispensing & Blending Instructions (static) */}
      <Card>
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">Dispensing &amp; Blending Instructions</h2>
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          {BLENDING_INSTRUCTIONS.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      </Card>

      {/* Per-mix sections */}
      {batch.mixes.map((m) => {
        const mixState = mixes[m.id];
        const rec = reconciliation[m.id];
        return (
          <Card key={m.id}>
            <h2 className="mb-3 text-[15px] font-semibold text-foreground">Mix No. {m.mixNumber} of {batch.numberOfMixes}</h2>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead><tr className={THEAD_ROW_CLASS}><Th>No.</Th><Th>RM Number</Th><Th>Ingredient / AAN</Th><Th>UIN</Th><Th>Required kg/mix</Th><Th>Actual dispensed, kg</Th><Th>Performed by (Sign)</Th><Th>Verified by (Sign)</Th></tr></thead>
                <tbody>
                  {m.dispensingLines.map((l, li) => {
                    const lineState = mixState.dispensingLines[li];
                    return (
                      <tr key={l.id} className="border-b border-border last:border-0">
                        <td className="px-2 py-1 text-muted-foreground">{li + 1}</td>
                        <td className="px-2 py-1 text-muted-foreground">{l.rmNumber ?? "RM"}</td>
                        <td className="px-2 py-1 text-foreground">{l.ingredientName}</td>
                        <td className="px-2 py-1 text-muted-foreground">{l.uin ?? "—"}</td>
                        <td className="px-2 py-1 font-medium text-foreground">{l.requiredQtyKg.toFixed(3)}</td>
                        <td className="px-2 py-1">
                          <input disabled={!canEdit} type="number" step="0.001" value={lineState.actualQtyDispensedKg ?? ""} onChange={(e) => setMixes({ ...mixes, [m.id]: { ...mixState, dispensingLines: mixState.dispensingLines.map((x, xi) => (xi === li ? { ...x, actualQtyDispensedKg: num(e.target.value) } : x)) } })} className="input w-24" />
                        </td>
                        <td className="px-2 py-1"><input disabled={!canEdit} value={lineState.performedBySign ?? ""} onChange={(e) => setMixes({ ...mixes, [m.id]: { ...mixState, dispensingLines: mixState.dispensingLines.map((x, xi) => (xi === li ? { ...x, performedBySign: e.target.value } : x)) } })} className="input" /></td>
                        <td className="px-2 py-1"><input disabled={!canEdit} value={lineState.verifiedBySign ?? ""} onChange={(e) => setMixes({ ...mixes, [m.id]: { ...mixState, dispensingLines: mixState.dispensingLines.map((x, xi) => (xi === li ? { ...x, verifiedBySign: e.target.value } : x)) } })} className="input" /></td>
                      </tr>
                    );
                  })}
                  <tr className="bg-primary/10 font-semibold text-foreground">
                    <td colSpan={4} className="px-2 py-2 text-right">TOTAL WEIGHT, Kg</td>
                    <td className="px-2 py-2">{m.dispensingLines.reduce((s, l) => s + l.requiredQtyKg, 0).toFixed(3)}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Dispensing started — Date"><input disabled={!canEdit} type="date" value={mixState.dispensingStartDate ?? ""} onChange={(e) => setMixes({ ...mixes, [m.id]: { ...mixState, dispensingStartDate: e.target.value } })} className="input" /></Field>
              <Field label="Time"><input disabled={!canEdit} type="time" value={mixState.dispensingStartTime ?? ""} onChange={(e) => setMixes({ ...mixes, [m.id]: { ...mixState, dispensingStartTime: e.target.value } })} className="input" /></Field>
              <Field label="Sign"><input disabled={!canEdit} value={mixState.dispensingStartSign ?? ""} onChange={(e) => setMixes({ ...mixes, [m.id]: { ...mixState, dispensingStartSign: e.target.value } })} className="input" /></Field>
              <Field label="Dispensing completed — Date"><input disabled={!canEdit} type="date" value={mixState.dispensingEndDate ?? ""} onChange={(e) => setMixes({ ...mixes, [m.id]: { ...mixState, dispensingEndDate: e.target.value } })} className="input" /></Field>
              <Field label="Time"><input disabled={!canEdit} type="time" value={mixState.dispensingEndTime ?? ""} onChange={(e) => setMixes({ ...mixes, [m.id]: { ...mixState, dispensingEndTime: e.target.value } })} className="input" /></Field>
              <Field label="Sign"><input disabled={!canEdit} value={mixState.dispensingEndSign ?? ""} onChange={(e) => setMixes({ ...mixes, [m.id]: { ...mixState, dispensingEndSign: e.target.value } })} className="input" /></Field>
              <Field label="Blending started — Date"><input disabled={!canEdit} type="date" value={mixState.blendingStartDate ?? ""} onChange={(e) => setMixes({ ...mixes, [m.id]: { ...mixState, blendingStartDate: e.target.value } })} className="input" /></Field>
              <Field label="Time"><input disabled={!canEdit} type="time" value={mixState.blendingStartTime ?? ""} onChange={(e) => setMixes({ ...mixes, [m.id]: { ...mixState, blendingStartTime: e.target.value } })} className="input" /></Field>
              <Field label="Sign"><input disabled={!canEdit} value={mixState.blendingStartSign ?? ""} onChange={(e) => setMixes({ ...mixes, [m.id]: { ...mixState, blendingStartSign: e.target.value } })} className="input" /></Field>
              <Field label="Blending completed — Date"><input disabled={!canEdit} type="date" value={mixState.blendingEndDate ?? ""} onChange={(e) => setMixes({ ...mixes, [m.id]: { ...mixState, blendingEndDate: e.target.value } })} className="input" /></Field>
              <Field label="Time"><input disabled={!canEdit} type="time" value={mixState.blendingEndTime ?? ""} onChange={(e) => setMixes({ ...mixes, [m.id]: { ...mixState, blendingEndTime: e.target.value } })} className="input" /></Field>
              <Field label="Sign"><input disabled={!canEdit} value={mixState.blendingEndSign ?? ""} onChange={(e) => setMixes({ ...mixes, [m.id]: { ...mixState, blendingEndSign: e.target.value } })} className="input" /></Field>
              <Field label="Mixing/Blending completed — Sign"><input disabled={!canEdit} value={mixState.mixCompletedSign ?? ""} onChange={(e) => setMixes({ ...mixes, [m.id]: { ...mixState, mixCompletedSign: e.target.value } })} className="input" /></Field>
              <Field label="Date"><input disabled={!canEdit} type="date" value={mixState.mixCompletedDate ?? ""} onChange={(e) => setMixes({ ...mixes, [m.id]: { ...mixState, mixCompletedDate: e.target.value } })} className="input" /></Field>
              <Field label="Time"><input disabled={!canEdit} type="time" value={mixState.mixCompletedTime ?? ""} onChange={(e) => setMixes({ ...mixes, [m.id]: { ...mixState, mixCompletedTime: e.target.value } })} className="input" /></Field>
              <Field label="Verified by (Supervisor) — Sign"><input disabled={!canEdit} value={mixState.verifiedBySign ?? ""} onChange={(e) => setMixes({ ...mixes, [m.id]: { ...mixState, verifiedBySign: e.target.value } })} className="input" /></Field>
              <Field label="Date"><input disabled={!canEdit} type="date" value={mixState.verifiedByDate ?? ""} onChange={(e) => setMixes({ ...mixes, [m.id]: { ...mixState, verifiedByDate: e.target.value } })} className="input" /></Field>
              <Field label="Time"><input disabled={!canEdit} type="time" value={mixState.verifiedByTime ?? ""} onChange={(e) => setMixes({ ...mixes, [m.id]: { ...mixState, verifiedByTime: e.target.value } })} className="input" /></Field>
            </div>

            <h3 className="mb-2 mt-5 text-sm font-semibold text-foreground">Blend Identification — Drum Net Weights</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-sm">
                <thead><tr className={THEAD_ROW_CLASS}><Th>Drum No.</Th><Th>Net Weight, Kg</Th><Th>Pass Label Attached</Th></tr></thead>
                <tbody>
                  {mixState.drums.map((d, di) => (
                    <tr key={di} className="border-b border-border last:border-0">
                      <td className="px-2 py-1"><input disabled={!canEdit} value={d.drumNumber ?? ""} onChange={(e) => setMixes({ ...mixes, [m.id]: { ...mixState, drums: mixState.drums.map((x, xi) => (xi === di ? { ...x, drumNumber: e.target.value } : x)) } })} className="input w-24" /></td>
                      <td className="px-2 py-1"><input disabled={!canEdit} type="number" step="0.01" value={d.netWeightKg ?? ""} onChange={(e) => setMixes({ ...mixes, [m.id]: { ...mixState, drums: mixState.drums.map((x, xi) => (xi === di ? { ...x, netWeightKg: num(e.target.value) } : x)) } })} className="input w-28" /></td>
                      <td className="px-2 py-1"><input type="checkbox" disabled={!canEdit} checked={d.passLabelAttached} onChange={(e) => setMixes({ ...mixes, [m.id]: { ...mixState, drums: mixState.drums.map((x, xi) => (xi === di ? { ...x, passLabelAttached: e.target.checked } : x)) } })} className="h-4 w-4 rounded accent-primary" /></td>
                    </tr>
                  ))}
                  <tr className="bg-primary/10 font-semibold text-foreground">
                    <td className="px-2 py-2 text-right">Total (B)</td>
                    <td className="px-2 py-2">{rec.B.toFixed(2)} Kg</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
              {canEdit && (
                <div className="mt-2 flex gap-3">
                  <button onClick={() => setMixes({ ...mixes, [m.id]: { ...mixState, drums: [...mixState.drums, { passLabelAttached: false }] } })} className="text-xs font-medium text-primary hover:underline">+ Add drum</button>
                  {mixState.drums.length > 1 && <button onClick={() => setMixes({ ...mixes, [m.id]: { ...mixState, drums: mixState.drums.slice(0, -1) } })} className="text-xs font-medium text-danger hover:opacity-80">Remove last</button>}
                </div>
              )}
            </div>

            <h3 className="mb-2 mt-5 text-sm font-semibold text-foreground">Mix Reconciliation</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-lg border border-border p-3 text-sm">
              <p className="text-foreground">Total ACTUAL Weight dispensed (A): <span className="font-medium">{rec.A.toFixed(2)} Kg</span></p>
              <p className="text-foreground">Total Net Weight in Drums (B): <span className="font-medium">{rec.B.toFixed(2)} Kg</span></p>
              <Field label="Net Weight as Samples/Rejects/Spills (D), Kg"><input disabled={!canEdit} type="number" step="0.01" value={mixState.samplesRejectsSpillsKg ?? ""} onChange={(e) => setMixes({ ...mixes, [m.id]: { ...mixState, samplesRejectsSpillsKg: num(e.target.value) } })} className="input" /></Field>
              <p className="text-foreground">Mix Yield [(B)÷(A)]×100: <span className={`font-medium ${rec.yieldPct !== null && (rec.yieldPct < 99 || rec.yieldPct > 101) ? "text-danger" : ""}`}>{rec.yieldPct !== null ? `${rec.yieldPct.toFixed(2)}%` : "—"}</span> <span className="text-xs text-muted-foreground">(limit 99–101%)</span></p>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Field label="Weight of sample, g (M)"><input disabled={!canEdit} type="number" step="0.01" value={mixState.bulkSampleWeightG ?? ""} onChange={(e) => setMixes({ ...mixes, [m.id]: { ...mixState, bulkSampleWeightG: num(e.target.value) } })} className="input" /></Field>
              <Field label="Bulk Volume, ml (V1)"><input disabled={!canEdit} type="number" step="0.01" value={mixState.bulkVolumeMl ?? ""} onChange={(e) => setMixes({ ...mixes, [m.id]: { ...mixState, bulkVolumeMl: num(e.target.value) } })} className="input" /></Field>
              <Field label="Tapped Volume, ml (V2)"><input disabled={!canEdit} type="number" step="0.01" value={mixState.tappedVolumeMl ?? ""} onChange={(e) => setMixes({ ...mixes, [m.id]: { ...mixState, tappedVolumeMl: num(e.target.value) } })} className="input" /></Field>
              <div className="text-sm text-muted-foreground">
                <p>Bulk Density: {rec.bulkDensity !== null ? `${rec.bulkDensity.toFixed(3)} g/ml` : "—"}</p>
                <p>Tapped Density: {rec.tappedDensity !== null ? `${rec.tappedDensity.toFixed(3)} g/ml` : "—"}</p>
              </div>
            </div>
          </Card>
        );
      })}

      {/* Warehouse Return */}
      <Card>
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">Warehouse Return</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead><tr className={THEAD_ROW_CLASS}><Th>RM / AAN</Th><Th>kg/batch</Th><Th>Qty Used</Th><Th>Actual Qty Returned</Th><Th>Operator Sign</Th><Th>Date</Th></tr></thead>
            <tbody>
              {batch.warehouseReturns.map((w) => {
                const s = warehouseReturns[w.id];
                return (
                  <tr key={w.id} className="border-b border-border last:border-0">
                    <td className="px-2 py-1 text-foreground">{w.ingredientName}</td>
                    <td className="px-2 py-1 text-muted-foreground">{w.kgPerBatch?.toFixed(3) ?? "—"}</td>
                    <td className="px-2 py-1 text-muted-foreground">{w.qtyUsedKg?.toFixed(2) ?? "—"}</td>
                    <td className="px-2 py-1"><input disabled={!canEdit} type="number" step="0.01" value={s.actualQtyReturnedKg ?? ""} onChange={(e) => setWarehouseReturns({ ...warehouseReturns, [w.id]: { ...s, actualQtyReturnedKg: num(e.target.value) } })} className="input w-28" /></td>
                    <td className="px-2 py-1"><input disabled={!canEdit} value={s.operatorSign ?? ""} onChange={(e) => setWarehouseReturns({ ...warehouseReturns, [w.id]: { ...s, operatorSign: e.target.value } })} className="input" /></td>
                    <td className="px-2 py-1"><input disabled={!canEdit} type="date" value={s.operatorDate ?? ""} onChange={(e) => setWarehouseReturns({ ...warehouseReturns, [w.id]: { ...s, operatorDate: e.target.value } })} className="input" /></td>
                  </tr>
                );
              })}
              <tr className="bg-primary/10 font-semibold text-foreground">
                <td className="px-2 py-2 text-right">TOTAL WEIGHT</td>
                <td className="px-2 py-2">{batch.warehouseReturns.reduce((s, w) => s + (w.kgPerBatch ?? 0), 0).toFixed(2)}</td>
                <td colSpan={4}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Raw Materials Request Document */}
      <Card>
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">Raw Materials Request Document</h2>
        <div className="mb-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <p>Product: <span className="font-medium text-foreground">{batch.productName}</span></p>
          <p>Batch No.: <span className="font-medium text-foreground">{batch.batchNumber}</span></p>
          <p>No. of Mixes: <span className="font-medium text-foreground">{batch.numberOfMixes}</span></p>
          <p>Batch Size/Mix: <span className="font-medium text-foreground">{batch.batchSizePerMix.toFixed(2)} {batch.batchSizeUnit}</span></p>
          <p className="col-span-2 sm:col-span-4">Total Batch Size: <span className="font-medium text-foreground">{totalBatchSize.toFixed(2)} {batch.batchSizeUnit}</span></p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead><tr className={THEAD_ROW_CLASS}><Th>RM / AAN</Th><Th>kg/batch</Th><Th>Qty Released</Th><Th>Actual Qty Received</Th><Th>Operator Sign</Th><Th>Date</Th></tr></thead>
            <tbody>
              {batch.materialRequests.map((m) => {
                const s = materialRequests[m.id];
                return (
                  <tr key={m.id} className="border-b border-border last:border-0">
                    <td className="px-2 py-1 text-foreground">{m.ingredientName}</td>
                    <td className="px-2 py-1 text-muted-foreground">{m.kgPerBatch?.toFixed(3) ?? "—"}</td>
                    <td className="px-2 py-1 text-muted-foreground">{m.qtyReleasedKg?.toFixed(2) ?? "—"}</td>
                    <td className="px-2 py-1"><input disabled={!canEdit} type="number" step="0.01" value={s.actualQtyReceivedKg ?? ""} onChange={(e) => setMaterialRequests({ ...materialRequests, [m.id]: { ...s, actualQtyReceivedKg: num(e.target.value) } })} className="input w-28" /></td>
                    <td className="px-2 py-1"><input disabled={!canEdit} value={s.operatorSign ?? ""} onChange={(e) => setMaterialRequests({ ...materialRequests, [m.id]: { ...s, operatorSign: e.target.value } })} className="input" /></td>
                    <td className="px-2 py-1"><input disabled={!canEdit} type="date" value={s.operatorDate ?? ""} onChange={(e) => setMaterialRequests({ ...materialRequests, [m.id]: { ...s, operatorDate: e.target.value } })} className="input" /></td>
                  </tr>
                );
              })}
              <tr className="bg-primary/10 font-semibold text-foreground">
                <td className="px-2 py-2 text-right">TOTAL WEIGHT</td>
                <td className="px-2 py-2">{batch.materialRequests.reduce((s, m) => s + (m.kgPerBatch ?? 0), 0).toFixed(2)}</td>
                <td colSpan={4}></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Released By (Warehouse)"><input disabled={!canEdit} value={header.releasedByWarehouse} onChange={(e) => setHeader({ ...header, releasedByWarehouse: e.target.value })} className="input" /></Field>
          <Field label="Date"><input disabled={!canEdit} type="date" value={header.releasedDate} onChange={(e) => setHeader({ ...header, releasedDate: e.target.value })} className="input" /></Field>
          <Field label="Checked By"><input disabled={!canEdit} value={header.requestCheckedBy} onChange={(e) => setHeader({ ...header, requestCheckedBy: e.target.value })} className="input" /></Field>
          <Field label="AILS No."><input disabled={!canEdit} value={header.ailsNumber} onChange={(e) => setHeader({ ...header, ailsNumber: e.target.value })} className="input" /></Field>
          <Field label="Pallet No."><input disabled={!canEdit} value={header.palletNumber} onChange={(e) => setHeader({ ...header, palletNumber: e.target.value })} className="input" /></Field>
        </div>
      </Card>

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={pending}>{pending ? "Saving..." : "Save"}</Button>
        </div>
      )}
    </div>
  );
}
