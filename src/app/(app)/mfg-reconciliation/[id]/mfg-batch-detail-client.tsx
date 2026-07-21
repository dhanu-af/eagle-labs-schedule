"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MfgBatchStatus } from "@/generated/prisma";
import { deleteMfgBatch, markMfgBatchCompleted, getMfgBatchAuditTrail } from "@/lib/actions/mfg-reconciliation-actions";
import { MFG_BATCH_STATUS_LABEL } from "@/lib/mfg-reconciliation-defaults";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import WarehouseIssueSection, { type WarehouseIssueData } from "./warehouse-issue-section";
import BlendingSection, { type BlendingData } from "./blending-section";
import EncapsulationSection, { type EncapsulationData } from "./encapsulation-section";
import BottlingSection, { type BottlingData } from "./bottling-section";
import XraySection, { type XrayData } from "./xray-section";
import PackagingSection, { type PackagingData } from "./packaging-section";
import FgWarehouseSection, { type FgWarehouseData } from "./fg-warehouse-section";
import DispatchSection, { type DispatchEventData } from "./dispatch-section";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 border-t border-border pt-3 first:border-0 first:pt-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{title}</p>
      {children}
    </div>
  );
}

export type MfgBatchDetail = {
  id: string;
  batchNumber: string;
  productName: string;
  status: MfgBatchStatus;
  remarks: string | null;
  batchRecordLabel: string | null;
  createdAt: string;
  warehouseIssue: WarehouseIssueData | null;
  blending: BlendingData | null;
  encapsulation: EncapsulationData | null;
  bottling: BottlingData | null;
  xrayInspection: XrayData | null;
  packaging: PackagingData | null;
  finishedGoodsWarehouse: FgWarehouseData | null;
  dispatchEvents: DispatchEventData[];
};

const STAGES = [
  { key: "warehouseIssue", label: "1. Warehouse Issue" },
  { key: "blending", label: "2. Blending" },
  { key: "encapsulation", label: "3. Encapsulation" },
  { key: "bottling", label: "4. Bottling" },
  { key: "xray", label: "5. X-Ray / Metal Detection" },
  { key: "packaging", label: "6. Packaging" },
  { key: "fgWarehouse", label: "7. Finished Goods Warehouse" },
  { key: "dispatch", label: "8. Dispatch" },
] as const;
type StageKey = (typeof STAGES)[number]["key"];

export default function MfgBatchDetailClient({
  batch,
  canManage,
}: {
  batch: MfgBatchDetail;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [stage, setStage] = useState<StageKey>("warehouseIssue");
  const [audit, setAudit] = useState<{ id: string; actorName: string; summary: string; createdAt: string }[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMfgBatchAuditTrail(batch.id).then((entries) => {
      if (!cancelled) setAudit(entries);
    });
    return () => {
      cancelled = true;
    };
  }, [batch.id]);

  function run(action: () => Promise<unknown>) {
    setError("");
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  function complete() {
    run(() => markMfgBatchCompleted(batch.id));
  }

  function remove() {
    if (!confirm(`Delete manufacturing batch ${batch.batchNumber}? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteMfgBatch(batch.id);
        router.push("/mfg-reconciliation");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <button onClick={() => router.push("/mfg-reconciliation")} className="text-xs font-medium text-muted-foreground hover:text-foreground">
        ← Back to Manufacturing Reconciliation
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {batch.batchNumber} <span className="font-normal text-muted-foreground">— {batch.productName}</span>
          </h1>
          {batch.batchRecordLabel && <p className="text-xs text-muted-foreground">Linked Batch Record: {batch.batchRecordLabel}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={batch.status === "COMPLETED" ? "success" : "info"}>{MFG_BATCH_STATUS_LABEL[batch.status]}</Badge>
          {canManage && batch.status === "IN_PROGRESS" && (
            <Button variant="secondary" size="sm" onClick={complete} disabled={pending}>
              Mark Completed
            </Button>
          )}
          {canManage && (
            <button
              onClick={remove}
              disabled={pending}
              className="text-xs font-medium text-danger hover:opacity-80 disabled:opacity-40"
            >
              Delete Batch
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {STAGES.map((s) => (
          <button
            key={s.key}
            onClick={() => setStage(s.key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150 ease-out ${
              stage === s.key
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="card-elevated rounded-xl border border-border bg-surface p-5">
        {stage === "warehouseIssue" && (
          <WarehouseIssueSection
            batchId={batch.id}
            data={batch.warehouseIssue}
            canManage={canManage}
            hasBatchRecordLink={!!batch.batchRecordLabel}
          />
        )}
        {stage === "blending" && <BlendingSection batchId={batch.id} data={batch.blending} canManage={canManage} />}
        {stage === "encapsulation" && <EncapsulationSection batchId={batch.id} data={batch.encapsulation} canManage={canManage} />}
        {stage === "bottling" && <BottlingSection batchId={batch.id} data={batch.bottling} canManage={canManage} />}
        {stage === "xray" && <XraySection batchId={batch.id} data={batch.xrayInspection} canManage={canManage} />}
        {stage === "packaging" && <PackagingSection batchId={batch.id} data={batch.packaging} canManage={canManage} />}
        {stage === "fgWarehouse" && <FgWarehouseSection batchId={batch.id} data={batch.finishedGoodsWarehouse} canManage={canManage} />}
        {stage === "dispatch" && <DispatchSection batchId={batch.id} events={batch.dispatchEvents} canManage={canManage} />}
      </div>

      <div className="card-elevated space-y-2 rounded-xl border border-border bg-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Audit Trail</p>
        {audit === null ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : audit.length === 0 ? (
          <p className="text-xs text-muted-foreground">No history yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {audit.map((a) => (
              <li key={a.id} className="text-foreground">
                <span className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()} — </span>
                {a.summary}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
