"use server";

import { getActiveOrdersWithRisk } from "@/lib/actions/customer-order-actions";
import { getCapacityOverview } from "@/lib/actions/capacity-planning-actions";
import { toDateKey } from "@/lib/capacity-planning-defaults";

export type TopRisk = { orderId: string; orderNumber: string; customerName: string; reasons: string[]; severity: "overdue" | "qaHeld" | "atRisk" };

export type TodaysProductionRow = { machineName: string; batchNumber: string; productName: string; estimatedHours: number };

export type ControlTowerSnapshot = {
  ordersDueToday: number;
  ordersDueThisWeek: number;
  overdueCount: number;
  atRiskCount: number;
  qaHeldCount: number;
  ordersAffectedByShortage: number;
  capacity: { availableHours: number; scheduledHours: number; utilizationPct: number | null; overloadedMachines: number };
  topRisks: TopRisk[];
  todaysProduction: TodaysProductionRow[];
};

/** Aggregates everything already built (Customer Orders' risk/QA, Capacity Planning's
 * utilization, Procurement's shortage-coverage signal already folded into material
 * checks) into the single "first screen" view -- no new queries beyond what those
 * modules' own functions already run; this file is pure composition. */
export async function getControlTowerSnapshot(): Promise<ControlTowerSnapshot> {
  const [activeOrders, capacityToday] = await Promise.all([getActiveOrdersWithRisk(), getCapacityOverview(new Date(), 1)]);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const endOfWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dueDate = (o: (typeof activeOrders)[number]) => new Date(o.confirmedDeliveryDate ?? o.requestedDeliveryDate);

  const ordersDueToday = activeOrders.filter((o) => dueDate(o) >= startOfToday && dueDate(o) < endOfToday).length;
  const ordersDueThisWeek = activeOrders.filter((o) => dueDate(o) >= startOfToday && dueDate(o) < endOfWeek).length;
  const overdueCount = activeOrders.filter((o) => o.risk.overdue).length;
  const atRiskCount = activeOrders.filter((o) => o.risk.atRisk).length;
  const qaHeldCount = activeOrders.filter((o) => o.qaStatus === "HELD").length;
  const ordersAffectedByShortage = activeOrders.filter((o) => o.shortLineCount > 0).length;

  const topRisks: TopRisk[] = activeOrders
    .filter((o) => o.risk.overdue || o.risk.atRisk || o.qaStatus === "HELD")
    .map((o) => {
      const reasons = [...o.risk.reasons];
      if (o.qaStatus === "HELD") reasons.push("QA hold on a linked batch");
      const severity: TopRisk["severity"] = o.risk.overdue ? "overdue" : o.qaStatus === "HELD" ? "qaHeld" : "atRisk";
      return { orderId: o.id, orderNumber: o.orderNumber, customerName: o.customerName, reasons, severity };
    })
    .sort((a, b) => {
      const rank = { overdue: 0, qaHeld: 1, atRisk: 2 };
      return rank[a.severity] - rank[b.severity];
    });

  const todayKey = toDateKey(new Date());
  let availableHours = 0;
  let scheduledHours = 0;
  let overloadedMachines = 0;
  const todaysProduction: TodaysProductionRow[] = [];
  for (const row of capacityToday.rows) {
    const cell = row.cells[todayKey];
    if (!cell) continue;
    availableHours += cell.availableHours;
    scheduledHours += cell.scheduledHours;
    if (cell.overload) overloadedMachines += 1;
    for (const b of cell.batches) {
      todaysProduction.push({ machineName: row.name, batchNumber: b.batchNumber, productName: b.productName, estimatedHours: b.estimatedHours });
    }
  }
  const utilizationPct = availableHours > 0 ? Math.round((scheduledHours / availableHours) * 1000) / 10 : scheduledHours > 0 ? null : 0;

  return {
    ordersDueToday,
    ordersDueThisWeek,
    overdueCount,
    atRiskCount,
    qaHeldCount,
    ordersAffectedByShortage,
    capacity: { availableHours, scheduledHours, utilizationPct, overloadedMachines },
    topRisks,
    todaysProduction,
  };
}
