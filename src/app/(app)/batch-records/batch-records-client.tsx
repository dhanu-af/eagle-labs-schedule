"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CheckStatus } from "@/generated/prisma";
import { createBatchRecordFromFormulation, deleteBatchRecord } from "@/lib/actions/batch-record-actions";
import { formatBrisbaneDateTime } from "@/lib/ui";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Th, THEAD_ROW_CLASS } from "@/components/ui/Th";
import { STATUS_BADGE } from "../checks/status-badge";

type Formulation = { id: string; productName: string; baseBatchSize: number; baseUnit: string };
type BatchRow = {
  id: string;
  productName: string;
  batchNumber: string;
  numberOfMixes: number;
  batchSizePerMix: number;
  batchSizeUnit: string;
  status: CheckStatus;
  locked: boolean;
  createdByName: string | null;
  updatedAt: string;
};

export default function BatchRecordsClient({
  canCreate,
  canDelete,
  formulations,
  records,
}: {
  canCreate: boolean;
  canDelete: boolean;
  formulations: Formulation[];
  records: BatchRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showNew, setShowNew] = useState(false);
  const [formulationId, setFormulationId] = useState(formulations[0]?.id ?? "");
  const [batchNumber, setBatchNumber] = useState("");
  const [numberOfMixes, setNumberOfMixes] = useState(1);
  const [batchSizePerMix, setBatchSizePerMix] = useState(0);
  const [batchSizeUnit, setBatchSizeUnit] = useState("kg");
  const [error, setError] = useState("");

  function create() {
    setError("");
    startTransition(async () => {
      try {
        const batch = await createBatchRecordFromFormulation({
          formulationId,
          batchNumber,
          numberOfMixes,
          batchSizePerMix,
          batchSizeUnit,
        });
        setShowNew(false);
        router.push(`/batch-records/${batch.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't create batch record.");
      }
    });
  }

  function remove(id: string, label: string) {
    if (!confirm(`Delete the Batch Manufacturing Record for "${label}"? This cannot be undone.`)) return;
    startTransition(async () => {
      await deleteBatchRecord(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Batch Manufacturing Records"
        subtitle="Full GMP blending batch records — work log, line clearance, per-mix dispensing & reconciliation, warehouse return, and PDF export."
        actions={
          canCreate && (
            <Button onClick={() => setShowNew(true)} disabled={formulations.length === 0}>
              + New Batch Record
            </Button>
          )
        }
      />

      {formulations.length === 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-xs text-warning">
          Create a formulation in Formula Manager first — a Batch Record is started from an existing formulation's bill of materials.
        </div>
      )}

      <Card padding="none" className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className={THEAD_ROW_CLASS}>
              <Th>Product Name</Th>
              <Th>Batch Number</Th>
              <Th>Mixes</Th>
              <Th>Batch Size / Mix</Th>
              <Th>Status</Th>
              <Th>Last Updated</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 transition-colors duration-150 ease-out even:bg-surface-muted/30 hover:bg-surface-muted/60">
                <td className="px-3 py-2.5 font-medium text-foreground">
                  <Link href={`/batch-records/${r.id}`} className="hover:underline">
                    {r.productName}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.batchNumber}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.numberOfMixes}</td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {r.batchSizePerMix.toFixed(2)} {r.batchSizeUnit}
                </td>
                <td className="px-3 py-2.5">{STATUS_BADGE[r.status]}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{formatBrisbaneDateTime(r.updatedAt)}</td>
                <td className="px-3 py-2.5 flex items-center gap-3">
                  <Link href={`/batch-records/${r.id}`} className="text-xs font-medium text-primary hover:underline">
                    Open →
                  </Link>
                  {canDelete && (
                    <button
                      onClick={() => remove(r.id, `${r.productName} ${r.batchNumber}`)}
                      disabled={pending}
                      className="text-xs font-medium text-danger hover:opacity-80"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState title="No batch records yet." description="Start one from an existing formulation to begin tracking a production run." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card-elevated w-full max-w-md rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 text-base font-semibold text-foreground">New Batch Manufacturing Record</h2>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Formulation</span>
                <select
                  value={formulationId}
                  onChange={(e) => setFormulationId(e.target.value)}
                  className="input"
                >
                  {formulations.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.productName} ({f.baseBatchSize} {f.baseUnit} basis)
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Batch Number</span>
                <input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} placeholder="e.g. 2618210021" className="input" />
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Number of Mixes</span>
                  <input
                    type="number"
                    min={1}
                    value={numberOfMixes}
                    onChange={(e) => setNumberOfMixes(Math.max(1, Number(e.target.value)))}
                    className="input"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Batch Size per Mix</span>
                  <input
                    type="number"
                    step="0.01"
                    value={batchSizePerMix}
                    onChange={(e) => setBatchSizePerMix(Number(e.target.value))}
                    className="input"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Unit</span>
                  <select value={batchSizeUnit} onChange={(e) => setBatchSizeUnit(e.target.value)} className="input">
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="mg">mg</option>
                  </select>
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Required quantities for each raw material will be scaled from the formulation's bill of materials to match this batch size per mix.
              </p>
              {error && <p className="text-xs text-danger">{error}</p>}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowNew(false)}>
                Cancel
              </Button>
              <Button onClick={create} disabled={pending || !formulationId || !batchNumber.trim() || batchSizePerMix <= 0}>
                {pending ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
