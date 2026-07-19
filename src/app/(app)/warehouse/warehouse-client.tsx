"use client";

import { useState } from "react";
import type {
  WarehouseItemCategory,
  WarehouseZone,
  GoodsReceivingLineStatus,
  WarehouseRequestStatus,
  ReceiptOutcome,
  Priority,
  StockBucket,
} from "@/generated/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import DashboardTab from "./dashboard-tab";
import StockOverviewTab from "./stock-overview-tab";
import GoodsReceivingTab from "./goods-receiving-tab";
import ProductionRequestsTab from "./production-requests-tab";

export type StockSummary = Record<StockBucket, number> & { QUARANTINE: number };

export type WarehouseItemRow = {
  id: string;
  itemCode: string;
  name: string;
  category: WarehouseItemCategory;
  subCategory: string | null;
  ingredientId: string | null;
  unit: string;
  minimumStock: number | null;
  maximumStock: number | null;
  defaultLocationId: string | null;
  stock: StockSummary | null;
};

export type WarehouseLocationRow = {
  id: string;
  code: string;
  label: string;
  zone: WarehouseZone;
  parentId: string | null;
};

export type GoodsReceivingLineRow = {
  id: string;
  itemId: string;
  itemName: string;
  lotNumber: string;
  supplierLot: string | null;
  internalLot: string | null;
  expiryDate: string | null;
  manufactureDate: string | null;
  quantity: number;
  unit: string;
  coaReference: string | null;
  photoReference: string | null;
  deliveryDocketReference: string | null;
  storageCondition: string | null;
  status: GoodsReceivingLineStatus;
  locationId: string | null;
  qaReleasedByName: string | null;
  qaReleasedAt: string | null;
  qaRejectReason: string | null;
};

export type GoodsReceivingRow = {
  id: string;
  supplierName: string;
  poNumber: string | null;
  deliveryDate: string;
  invoiceRef: string | null;
  receivedByName: string;
  checkedByName: string | null;
  approvedByName: string | null;
  createdAt: string;
  lines: GoodsReceivingLineRow[];
};

export type RequestLineRow = {
  id: string;
  itemId: string | null;
  itemName: string | null;
  ingredientNameFreeText: string | null;
  requestedQty: number;
  unit: string;
  releasedQty: number | null;
  releaseLotNumber: string | null;
  releaseExpiry: string | null;
  releaseLocationId: string | null;
  releasedByName: string | null;
  releasedAt: string | null;
  releaseComments: string | null;
  receiptOutcome: ReceiptOutcome | null;
  receivedQty: number | null;
  receivedByName: string | null;
  receivedAt: string | null;
  usedQty: number | null;
  wasteQty: number | null;
  returnQty: number | null;
  returnConditionNotes: string | null;
  returnLocationId: string | null;
  returnSubmittedByName: string | null;
  returnSubmittedAt: string | null;
  returnVerifiedByName: string | null;
  returnVerifiedAt: string | null;
};

export type MaterialRequestRow = {
  id: string;
  requestNumber: string;
  batchReference: string;
  batchSize: number | null;
  batchSizeUnit: string | null;
  requiredDate: string | null;
  priority: Priority;
  status: WarehouseRequestStatus;
  requestedByName: string;
  comments: string | null;
  createdAt: string;
  lines: RequestLineRow[];
};

const TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "stock-overview", label: "Stock Overview" },
  { key: "goods-receiving", label: "Goods Receiving" },
  { key: "production-requests", label: "Production Requests" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function WarehouseClient({
  items,
  locations,
  receivings,
  requests,
  canManage,
  canRequest,
  canQaRelease,
  isSuperAdmin,
}: {
  items: WarehouseItemRow[];
  locations: WarehouseLocationRow[];
  receivings: GoodsReceivingRow[];
  requests: MaterialRequestRow[];
  canManage: boolean;
  canRequest: boolean;
  canQaRelease: boolean;
  isSuperAdmin: boolean;
}) {
  const [tab, setTab] = useState<TabKey>("dashboard");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Warehouse Management"
        subtitle="Receiving, stock visibility, and the production material request & return cycle."
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

      {tab === "dashboard" && <DashboardTab items={items} requests={requests} receivings={receivings} />}

      {tab === "stock-overview" && (
        <StockOverviewTab
          items={items}
          locations={locations}
          receivings={receivings}
          canManage={canManage}
        />
      )}

      {tab === "goods-receiving" && (
        <GoodsReceivingTab
          receivings={receivings}
          items={items}
          locations={locations}
          canManage={canManage}
          canQaRelease={canQaRelease}
          isSuperAdmin={isSuperAdmin}
        />
      )}

      {tab === "production-requests" && (
        <ProductionRequestsTab
          requests={requests}
          items={items}
          locations={locations}
          canManage={canManage}
          canRequest={canRequest}
          isSuperAdmin={isSuperAdmin}
        />
      )}
    </div>
  );
}
