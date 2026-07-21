"use client";

import { useState } from "react";
import type { MfgBatchStatus } from "@/generated/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import DashboardTab from "./dashboard-tab";
import BatchesTab from "./batches-tab";

export type MfgBatchRow = {
  id: string;
  batchNumber: string;
  productName: string;
  status: MfgBatchStatus;
  createdAt: string;
  blending: { totalTheoreticalWeightKg: number | null; totalBlendProducedKg: number | null } | null;
  encapsulation: { expectedCapsules: number | null; goodCapsules: number | null } | null;
  bottling: { expectedBottles: number | null; filledBottles: number | null } | null;
  qaReleased: boolean;
};

export type BatchRecordOption = { id: string; productName: string; batchNumber: string };

const TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "batches", label: "Batches" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function MfgReconciliationClient({
  batches,
  batchRecords,
  canManage,
}: {
  batches: MfgBatchRow[];
  batchRecords: BatchRecordOption[];
  canManage: boolean;
}) {
  const [tab, setTab] = useState<TabKey>("dashboard");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Manufacturing Reconciliation"
        subtitle="End-to-end batch traceability -- Warehouse Issue through Dispatch, every material and stage reconciled."
      />

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-out ${
              tab === t.key
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <DashboardTab batches={batches} />}
      {tab === "batches" && <BatchesTab batches={batches} batchRecords={batchRecords} canManage={canManage} />}
    </div>
  );
}
