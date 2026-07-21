"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MFG_BATCH_STATUS_LABEL } from "@/lib/mfg-reconciliation-defaults";
import { createMfgBatch } from "@/lib/actions/mfg-reconciliation-actions";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Th, THEAD_ROW_CLASS } from "@/components/ui/Th";
import { EmptyState } from "@/components/ui/EmptyState";
import type { MfgBatchRow, BatchRecordOption } from "./mfg-reconciliation-client";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function NewBatchModal({ batchRecords, onClose }: { batchRecords: BatchRecordOption[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [batchRecordId, setBatchRecordId] = useState("");
  const [productName, setProductName] = useState("");
  const [batchNumber, setBatchNumber] = useState("");

  function pickBatchRecord(id: string) {
    setBatchRecordId(id);
    const br = batchRecords.find((b) => b.id === id);
    if (br) {
      setProductName(br.productName);
      setBatchNumber(br.batchNumber);
    }
  }

  function save() {
    setError("");
    if (!productName || !batchNumber) {
      setError("Product name and batch number are required.");
      return;
    }
    startTransition(async () => {
      try {
        const batch = await createMfgBatch({ productName, batchNumber, batchRecordId: batchRecordId || null });
        router.push(`/mfg-reconciliation/${batch.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't create batch.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated w-full max-w-lg rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">New Manufacturing Batch</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field label="Batch Record (optional link)">
              <select className="input" value={batchRecordId} onChange={(e) => pickBatchRecord(e.target.value)}>
                <option value="">Free text instead...</option>
                {batchRecords.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batchNumber} — {b.productName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Product">
              <input className="input" value={productName} onChange={(e) => setProductName(e.target.value)} />
            </Field>
            <Field label="Batch Number">
              <input className="input" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} />
            </Field>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? "Creating..." : "Create Batch"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BatchesTab({
  batches,
  batchRecords,
  canManage,
}: {
  batches: MfgBatchRow[];
  batchRecords: BatchRecordOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return batches.filter((b) => {
      if (q && !`${b.batchNumber} ${b.productName}`.toLowerCase().includes(q)) return false;
      if (statusFilter && b.status !== statusFilter) return false;
      return true;
    });
  }, [batches, search, statusFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <input
            className="input w-64"
            placeholder="Search product or batch number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="input w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(MFG_BATCH_STATUS_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setShowNew(true)}>
            + New Batch
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No batches match" description="Adjust your filters or create a new manufacturing batch." />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={THEAD_ROW_CLASS}>
                  <Th>Batch Number</Th>
                  <Th>Product</Th>
                  <Th>Created</Th>
                  <Th>QA Released</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => router.push(`/mfg-reconciliation/${b.id}`)}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-muted/40"
                  >
                    <td className="px-3 py-2 font-medium text-foreground">{b.batchNumber}</td>
                    <td className="px-3 py-2">{b.productName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{new Date(b.createdAt).toLocaleDateString()}</td>
                    <td className="px-3 py-2">{b.qaReleased ? "Yes" : "—"}</td>
                    <td className="px-3 py-2">
                      <Badge tone={b.status === "COMPLETED" ? "success" : "info"}>{MFG_BATCH_STATUS_LABEL[b.status]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showNew && <NewBatchModal batchRecords={batchRecords} onClose={() => setShowNew(false)} />}
    </div>
  );
}
