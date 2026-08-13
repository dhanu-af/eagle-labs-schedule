"use client";

import { useMemo } from "react";
import type { CustomerOrderStatus, OrderPriority } from "@/generated/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CUSTOMER_ORDER_STATUS_LABELS } from "@/lib/customer-order-defaults";
import type { OrderRow } from "./customer-orders-client";

export type RiskOrderRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  status: CustomerOrderStatus;
  priority: OrderPriority;
  requestedDeliveryDate: string;
  confirmedDeliveryDate: string | null;
  risk: { overdue: boolean; atRisk: boolean; reasons: string[] };
};

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "danger" | "warning" }) {
  return (
    <Card padding="sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-foreground"}`}>{value}</p>
    </Card>
  );
}

export default function DashboardTab({ orders, riskOverview }: { orders: OrderRow[]; riskOverview: RiskOrderRow[] }) {
  const stats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    const endOfWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

    const active = orders.filter((o) => !["DISPATCHED", "DELIVERED", "CLOSED", "CANCELLED"].includes(o.status));

    const dueDate = (o: OrderRow) => new Date(o.confirmedDeliveryDate ?? o.requestedDeliveryDate);

    const dueToday = active.filter((o) => dueDate(o) >= startOfToday && dueDate(o) < endOfToday).length;
    const dueThisWeek = active.filter((o) => dueDate(o) >= startOfToday && dueDate(o) < endOfWeek).length;
    const overdue = riskOverview.filter((o) => o.risk.overdue).length;
    const atRisk = riskOverview.filter((o) => o.risk.atRisk).length;

    return { dueToday, dueThisWeek, overdue, atRisk };
  }, [orders, riskOverview]);

  const statusFunnel = useMemo(() => {
    const counts = new Map<CustomerOrderStatus, number>();
    for (const o of orders) counts.set(o.status, (counts.get(o.status) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [orders]);

  const riskList = riskOverview.filter((o) => o.risk.atRisk || o.risk.overdue);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Due Today" value={stats.dueToday} />
        <StatCard label="Due This Week" value={stats.dueThisWeek} />
        <StatCard label="Overdue" value={stats.overdue} tone="danger" />
        <StatCard label="At Risk" value={stats.atRisk} tone="warning" />
      </div>

      <Card padding="sm">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Orders by Status</p>
        <div className="flex flex-wrap gap-2">
          {statusFunnel.map(([status, count]) => (
            <Badge key={status} tone="muted">
              {CUSTOMER_ORDER_STATUS_LABELS[status]}: {count}
            </Badge>
          ))}
          {statusFunnel.length === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
        </div>
      </Card>

      <Card padding="sm">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Top Risks</p>
        {riskList.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active order is currently at risk or overdue.</p>
        ) : (
          <ul className="divide-y divide-border">
            {riskList.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {o.orderNumber} — {o.customerName}
                  </p>
                  <p className="text-xs text-muted-foreground">{o.risk.reasons.join("; ")}</p>
                </div>
                <Badge tone={o.risk.overdue ? "danger" : "warning"}>{o.risk.overdue ? "Overdue" : "At Risk"}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
