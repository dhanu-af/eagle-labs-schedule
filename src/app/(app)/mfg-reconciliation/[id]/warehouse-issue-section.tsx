"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MfgMaterialGroup } from "@/generated/prisma";
import { saveWarehouseIssue, populateWarehouseIssueFromBatchRecord } from "@/lib/actions/mfg-reconciliation-actions";
import { MFG_MATERIAL_GROUP_LABEL, RAW_MATERIAL_GROUPS, PACKAGING_MATERIAL_GROUPS, computeBalance } from "@/lib/mfg-reconciliation-defaults";
import { Button } from "@/components/ui/Button";
import { Field, Section } from "./mfg-batch-detail-client";

export type MaterialIssueLineData = {
  materialGroup: MfgMaterialGroup;
  materialCode: string | null;
  description: string;
  supplier: string | null;
  lotBatchNumber: string | null;
  expiryDate: string | null;
  quantityRequested: number | null;
  quantityIssued: number | null;
  quantityReturned: number | null;
};

export type WarehouseIssueData = {
  issuedByName: string | null;
  issueDate: string | null;
  remarks: string | null;
  lines: MaterialIssueLineData[];
};

type LineForm = {
  materialGroup: MfgMaterialGroup;
  materialCode: string;
  description: string;
  supplier: string;
  lotBatchNumber: string;
  expiryDate: string;
  quantityRequested: string;
  quantityIssued: string;
  quantityReturned: string;
};

function toLineForm(l: MaterialIssueLineData): LineForm {
  return {
    materialGroup: l.materialGroup,
    materialCode: l.materialCode ?? "",
    description: l.description,
    supplier: l.supplier ?? "",
    lotBatchNumber: l.lotBatchNumber ?? "",
    expiryDate: l.expiryDate?.slice(0, 10) ?? "",
    quantityRequested: l.quantityRequested?.toString() ?? "",
    quantityIssued: l.quantityIssued?.toString() ?? "",
    quantityReturned: l.quantityReturned?.toString() ?? "",
  };
}

const ALL_GROUPS = [...RAW_MATERIAL_GROUPS, ...PACKAGING_MATERIAL_GROUPS];

export default function WarehouseIssueSection({
  batchId,
  data,
  canManage,
  hasBatchRecordLink,
}: {
  batchId: string;
  data: WarehouseIssueData | null;
  canManage: boolean;
  hasBatchRecordLink: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [populating, startPopulateTransition] = useTransition();
  const [error, setError] = useState("");
  const [issuedByName, setIssuedByName] = useState(data?.issuedByName ?? "");
  const [issueDate, setIssueDate] = useState(data?.issueDate?.slice(0, 10) ?? "");
  const [remarks, setRemarks] = useState(data?.remarks ?? "");
  const [lines, setLines] = useState<LineForm[]>(() => (data?.lines ?? []).map(toLineForm));

  const [dataSyncedWith, setDataSyncedWith] = useState(data);
  if (dataSyncedWith !== data) {
    setDataSyncedWith(data);
    setLines((data?.lines ?? []).map(toLineForm));
  }

  function populateFromBatchRecord() {
    setError("");
    startPopulateTransition(async () => {
      try {
        await populateWarehouseIssueFromBatchRecord(batchId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't populate from Batch Record.");
      }
    });
  }

  function updateLine(i: number, patch: Partial<LineForm>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((ls) => [
      ...ls,
      { materialGroup: "RAW_INGREDIENT", materialCode: "", description: "", supplier: "", lotBatchNumber: "", expiryDate: "", quantityRequested: "", quantityIssued: "", quantityReturned: "" },
    ]);
  }

  function removeLine(i: number) {
    setLines((ls) => ls.filter((_, idx) => idx !== i));
  }

  function save() {
    setError("");
    startTransition(async () => {
      try {
        await saveWarehouseIssue(
          batchId,
          { issuedByName: issuedByName || null, issueDate: issueDate || null, remarks: remarks || null },
          lines.map((l) => ({
            materialGroup: l.materialGroup,
            materialCode: l.materialCode || null,
            description: l.description,
            supplier: l.supplier || null,
            lotBatchNumber: l.lotBatchNumber || null,
            expiryDate: l.expiryDate || null,
            quantityRequested: l.quantityRequested === "" ? null : Number(l.quantityRequested),
            quantityIssued: l.quantityIssued === "" ? null : Number(l.quantityIssued),
            quantityReturned: l.quantityReturned === "" ? null : Number(l.quantityReturned),
          }))
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Section title="Header">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field label="Issued By">
            <input className="input" disabled={!canManage} value={issuedByName} onChange={(e) => setIssuedByName(e.target.value)} />
          </Field>
          <Field label="Issue Date">
            <input type="date" className="input" disabled={!canManage} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Raw Materials & Packaging Materials">
        {canManage && hasBatchRecordLink && (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Pull the ingredient list straight from the linked Batch Record.</p>
            <Button variant="secondary" size="sm" onClick={populateFromBatchRecord} disabled={populating}>
              {populating ? "Populating..." : "Populate from Batch Record"}
            </Button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="px-2 py-1">Group</th>
                <th className="px-2 py-1">Material Code</th>
                <th className="px-2 py-1">Description</th>
                <th className="px-2 py-1">Supplier</th>
                <th className="px-2 py-1">Lot/Batch No.</th>
                <th className="px-2 py-1">Expiry</th>
                <th className="px-2 py-1">Requested</th>
                <th className="px-2 py-1">Issued</th>
                <th className="px-2 py-1">Returned</th>
                <th className="px-2 py-1">Balance</th>
                {canManage && <th className="px-2 py-1" />}
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-2 py-1">
                    <select
                      className="input py-1"
                      disabled={!canManage}
                      value={l.materialGroup}
                      onChange={(e) => updateLine(i, { materialGroup: e.target.value as MfgMaterialGroup })}
                    >
                      {ALL_GROUPS.map((g) => (
                        <option key={g} value={g}>
                          {MFG_MATERIAL_GROUP_LABEL[g]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <input className="input py-1" disabled={!canManage} value={l.materialCode} onChange={(e) => updateLine(i, { materialCode: e.target.value })} />
                  </td>
                  <td className="px-2 py-1">
                    <input className="input py-1" disabled={!canManage} value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} />
                  </td>
                  <td className="px-2 py-1">
                    <input className="input py-1" disabled={!canManage} value={l.supplier} onChange={(e) => updateLine(i, { supplier: e.target.value })} />
                  </td>
                  <td className="px-2 py-1">
                    <input className="input py-1" disabled={!canManage} value={l.lotBatchNumber} onChange={(e) => updateLine(i, { lotBatchNumber: e.target.value })} />
                  </td>
                  <td className="px-2 py-1">
                    <input type="date" className="input py-1" disabled={!canManage} value={l.expiryDate} onChange={(e) => updateLine(i, { expiryDate: e.target.value })} />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" className="input w-20 py-1" disabled={!canManage} value={l.quantityRequested} onChange={(e) => updateLine(i, { quantityRequested: e.target.value })} />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" className="input w-20 py-1" disabled={!canManage} value={l.quantityIssued} onChange={(e) => updateLine(i, { quantityIssued: e.target.value })} />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" className="input w-20 py-1" disabled={!canManage} value={l.quantityReturned} onChange={(e) => updateLine(i, { quantityReturned: e.target.value })} />
                  </td>
                  <td className="px-2 py-1 tabular-nums text-foreground">
                    {computeBalance(l.quantityIssued === "" ? null : Number(l.quantityIssued), l.quantityReturned === "" ? null : Number(l.quantityReturned)) ?? "—"}
                  </td>
                  {canManage && (
                    <td className="px-2 py-1">
                      <button onClick={() => removeLine(i)} className="text-danger hover:opacity-80">
                        ✕
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canManage && (
          <button onClick={addLine} className="text-xs font-medium text-primary hover:opacity-80">
            + Add Material Line
          </button>
        )}
      </Section>

      <Section title="Remarks">
        <textarea className="input" rows={2} disabled={!canManage} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </Section>

      {error && <p className="text-xs text-danger">{error}</p>}
      {canManage && (
        <div className="text-right">
          <Button size="sm" onClick={save} disabled={pending}>
            {pending ? "Saving..." : "Save Warehouse Issue"}
          </Button>
        </div>
      )}
    </div>
  );
}
