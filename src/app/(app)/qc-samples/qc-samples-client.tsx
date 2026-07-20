"use client";

import { useState } from "react";
import type { QcSampleType, QcSampleStatus, QcProductCategory, QcTestResult } from "@/generated/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import DashboardTab from "./dashboard-tab";
import SamplesTab from "./samples-tab";
import ReportsTab from "./reports-tab";
import SampleDetailModal from "./sample-detail-modal";

export type QcLabTestItemRow = { section: string; parameter: string; result: QcTestResult | null; details: string | null };

export type QcLabTestRow = {
  testedByName: string | null;
  testedAt: string | null;
  items: QcLabTestItemRow[];
};

export type QcRetentionRow = {
  shelf: string | null;
  cabinet: string | null;
  boxNumber: string | null;
  position: string | null;
  quantityRemaining: number | null;
  opened: boolean;
  lastChecked: string | null;
  expiryDate: string | null;
  destroyDate: string | null;
};

export type QcSampleRow = {
  id: string;
  sampleId: string;
  productName: string;
  batchNumber: string;
  batchRecordId: string | null;
  manufacturingDate: string | null;
  expiryDate: string | null;
  sampleType: QcSampleType;
  productCategory: QcProductCategory | null;
  quantity: number;
  unit: string;
  collectedByName: string | null;
  collectionDate: string | null;
  collectionTime: string | null;
  productionRoom: string | null;
  sampleStorageLocation: string | null;
  storageTemperature: string | null;
  storageCondition: string | null;
  sentToLab: boolean;
  sentDate: string | null;
  courierOrInternal: string | null;
  laboratoryName: string | null;
  laboratoryLocation: string | null;
  receivedByQcName: string | null;
  receivedDate: string | null;
  status: QcSampleStatus;
  remarks: string | null;
  createdByName: string | null;
  createdAt: string;
  labTest: QcLabTestRow | null;
  retentionRecord: QcRetentionRow | null;
};

export type BatchRecordOption = { id: string; productName: string; batchNumber: string };

const TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "samples", label: "Samples" },
  { key: "reports", label: "Reports" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function QcSamplesClient({
  samples,
  batchRecords,
  bayOptions,
  locationOptions,
  canCollect,
  canManage,
  canRunLabTesting,
  isSuperAdmin,
}: {
  samples: QcSampleRow[];
  batchRecords: BatchRecordOption[];
  bayOptions: string[];
  locationOptions: string[];
  canCollect: boolean;
  canManage: boolean;
  canRunLabTesting: boolean;
  isSuperAdmin: boolean;
}) {
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = samples.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="QC Samples"
        subtitle="Complete QC sample lifecycle with full batch traceability."
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

      {tab === "dashboard" && <DashboardTab samples={samples} onSelect={setSelectedId} />}

      {tab === "samples" && (
        <SamplesTab
          samples={samples}
          batchRecords={batchRecords}
          bayOptions={bayOptions}
          locationOptions={locationOptions}
          canCollect={canCollect}
          onSelect={setSelectedId}
        />
      )}

      {tab === "reports" && <ReportsTab samples={samples} />}

      {selected && (
        <SampleDetailModal
          sample={selected}
          batchRecords={batchRecords}
          bayOptions={bayOptions}
          locationOptions={locationOptions}
          canManage={canManage}
          canRunLabTesting={canRunLabTesting}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
