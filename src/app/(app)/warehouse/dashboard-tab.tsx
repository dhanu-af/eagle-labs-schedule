"use client";

import { Card } from "@/components/ui/Card";
import { isLowStock, expiryIndicator } from "@/lib/warehouse-defaults";
import type { WarehouseItemRow, MaterialRequestRow, GoodsReceivingRow } from "./warehouse-client";

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card interactive padding="sm">
      <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export default function DashboardTab({
  items,
  requests,
  receivings,
}: {
  items: WarehouseItemRow[];
  requests: MaterialRequestRow[];
  receivings: GoodsReceivingRow[];
}) {
  const totalIngredients = items.filter((i) => i.category === "RAW_MATERIAL").length;
  const totalPackaging = items.filter((i) => i.category === "PACKAGING").length;
  const totalFinishedGoods = items.filter((i) => i.category === "FINISHED_GOOD").length;
  const todaysReceipts = receivings.filter((r) => isToday(r.createdAt)).length;
  const pendingRequests = requests.filter((r) =>
    ["REQUESTED", "WAREHOUSE_PREPARING", "RELEASED", "WAITING_PRODUCTION_CONFIRMATION", "PARTIALLY_RECEIVED"].includes(r.status)
  ).length;
  const pendingReturns = requests.filter((r) => r.status === "RETURN_PENDING" || r.status === "WAREHOUSE_VERIFYING").length;
  const lowStockItems = items.filter((i) => i.stock && isLowStock(i.stock.AVAILABLE, i.minimumStock)).length;
  const expiredItemIds = new Set(
    receivings
      .flatMap((r) => r.lines)
      .filter((l) => l.status === "RELEASED" && l.expiryDate && expiryIndicator(l.expiryDate) === "🔴")
      .map((l) => l.itemId)
  );
  const quarantineItems = items.filter((i) => i.stock && i.stock.QUARANTINE > 0).length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Live Summary</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <StatCard label="Total Ingredients" value={totalIngredients} />
          <StatCard label="Total Packaging Materials" value={totalPackaging} />
          <StatCard label="Total Finished Goods" value={totalFinishedGoods} />
          <StatCard label="Today's Receipts" value={todaysReceipts} />
          <StatCard label="Today's Dispatch" value="N/A" />
          <StatCard label="Production Requests (pending)" value={pendingRequests} />
          <StatCard label="Pending Returns" value={pendingReturns} />
          <StatCard label="Low Stock Items" value={lowStockItems} />
          <StatCard label="Expired Items" value={expiredItemIds.size} />
          <StatCard label="Quarantine Items" value={quarantineItems} />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Dispatch, stock valuation, and consumption/movement charts aren&apos;t wired up yet — flag if you want those
          added next.
        </p>
      </div>
    </div>
  );
}
