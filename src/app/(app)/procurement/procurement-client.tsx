"use client";

import { useState } from "react";
import type { PurchaseOrderStatus } from "@/generated/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import PurchaseOrdersTab from "./purchase-orders-tab";
import SuppliersTab from "./suppliers-tab";
import type { UserOption } from "@/components/send-task-form";

export type SupplierRow = {
  id: string;
  code: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  leadTimeDays: number | null;
  notes: string | null;
  active: boolean;
};

export type PurchaseOrderLineRow = { id: string; itemName: string; itemCode: string; quantity: number; unit: string; notes: string | null };
export type PurchaseOrderRow = {
  id: string;
  poNumber: string;
  supplierName: string;
  orderDate: string;
  expectedDeliveryDate: string;
  status: PurchaseOrderStatus;
  notes: string | null;
  lines: PurchaseOrderLineRow[];
};

export type ItemOption = { id: string; itemCode: string; name: string; unit: string };

const TABS = [
  { key: "purchaseOrders", label: "Purchase Orders" },
  { key: "suppliers", label: "Suppliers" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function ProcurementClient({
  suppliers,
  purchaseOrders,
  items,
  canManage,
  taskRequestRecipients,
}: {
  suppliers: SupplierRow[];
  purchaseOrders: PurchaseOrderRow[];
  items: ItemOption[];
  canManage: boolean;
  taskRequestRecipients: UserOption[];
}) {
  const [tab, setTab] = useState<TabKey>("purchaseOrders");

  return (
    <div className="space-y-4">
      <PageHeader title="Procurement" subtitle="Suppliers and purchase orders — closes the loop when a customer order is short on material." />

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-out ${
              tab === t.key ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "purchaseOrders" && (
        <PurchaseOrdersTab
          purchaseOrders={purchaseOrders}
          suppliers={suppliers}
          items={items}
          canManage={canManage}
          taskRequestRecipients={taskRequestRecipients}
        />
      )}
      {tab === "suppliers" && <SuppliersTab suppliers={suppliers} canManage={canManage} />}
    </div>
  );
}
