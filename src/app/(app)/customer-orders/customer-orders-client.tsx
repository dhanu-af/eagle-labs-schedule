"use client";

import { useState } from "react";
import type { CustomerOrderStatus, OrderPriority } from "@/generated/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import DashboardTab, { type RiskOrderRow } from "./dashboard-tab";
import OrdersTab from "./orders-tab";
import BoardTab from "./board-tab";
import CustomersTab from "./customers-tab";
import ProductsTab from "./products-tab";

export type OrderLineRow = {
  id: string;
  lineNumber: number;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unit: string;
  packagingRequirement: string | null;
  artworkStatus: string | null;
  notes: string | null;
};

export type OrderRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerCode: string;
  customerPoNumber: string | null;
  customerRequestNumber: string | null;
  orderDate: string;
  requestedDeliveryDate: string;
  confirmedDeliveryDate: string | null;
  priority: OrderPriority;
  status: CustomerOrderStatus;
  shippingRequirements: string | null;
  specialRequirements: string | null;
  notes: string | null;
  lines: OrderLineRow[];
};

export type CustomerRow = {
  id: string;
  code: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
};

export type ProductRow = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  defaultUnit: string;
  formulationId: string | null;
  formulationName: string | null;
  active: boolean;
};

export type FormulationOption = { id: string; productName: string; baseBatchSize: number; baseUnit: string };
export type PlannerOption = { id: string; fullName: string };

const TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "orders", label: "Orders" },
  { key: "board", label: "Board" },
  { key: "customers", label: "Customers" },
  { key: "products", label: "Products" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function CustomerOrdersClient({
  orders,
  customers,
  products,
  formulations,
  planners,
  riskOverview,
  canManage,
}: {
  orders: OrderRow[];
  customers: CustomerRow[];
  products: ProductRow[];
  formulations: FormulationOption[];
  planners: PlannerOption[];
  riskOverview: RiskOrderRow[];
  canManage: boolean;
}) {
  const [tab, setTab] = useState<TabKey>("dashboard");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customer Orders"
        subtitle="Customer demand, material readiness, and delivery risk in one place — Phase 1."
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

      {tab === "dashboard" && <DashboardTab orders={orders} riskOverview={riskOverview} />}
      {tab === "orders" && (
        <OrdersTab orders={orders} customers={customers} products={products} planners={planners} canManage={canManage} />
      )}
      {tab === "board" && <BoardTab orders={orders} riskOverview={riskOverview} canManage={canManage} />}
      {tab === "customers" && <CustomersTab customers={customers} canManage={canManage} />}
      {tab === "products" && <ProductsTab products={products} formulations={formulations} canManage={canManage} />}
    </div>
  );
}
