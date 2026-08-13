import type { CustomerOrderStatus } from "@/generated/prisma";
import type { StockSummary } from "@/lib/warehouse-ledger";

/** Mass units the order's material check converts between — same table as
 * batch-record-actions.ts's createBatchRecordFromFormulation, so a line's quantity/unit
 * and a Formulation's baseBatchSize/baseUnit don't have to already share a unit. */
const UNIT_TO_MG: Record<string, number> = { mg: 1, g: 1000, kg: 1_000_000 };

function toMg(value: number, unit: string) {
  const key = unit.trim().toLowerCase();
  return key in UNIT_TO_MG ? value * UNIT_TO_MG[key] : value;
}

function fromMg(valueMg: number, unit: string) {
  const key = unit.trim().toLowerCase();
  return key in UNIT_TO_MG ? valueMg / UNIT_TO_MG[key] : valueMg;
}

/** Scales a Formulation's per-ingredient baseQty up to the quantity actually ordered on a
 * CustomerOrderLine, converting through mg the same way batch record creation does. */
export function scaleIngredientQtyKg(
  ingredientBaseQty: number,
  formulation: { baseBatchSize: number; baseUnit: string },
  line: { quantity: number; unit: string }
): number {
  const scale = toMg(line.quantity, line.unit) / toMg(formulation.baseBatchSize, formulation.baseUnit);
  const ingBaseMg = toMg(ingredientBaseQty, formulation.baseUnit);
  return Math.round(fromMg(ingBaseMg * scale, "kg") * 1000) / 1000;
}

export type MaterialLineStatus = "READY" | "SHORT" | "UNMAPPED";

export type MaterialCheckLine = {
  ingredientName: string;
  rmNumber: string | null;
  warehouseItemId: string | null;
  requiredQtyKg: number;
  availableQty: number | null;
  shortageQty: number | null;
  status: MaterialLineStatus;
};

export type MaterialCheckResult =
  | { lineStatus: "NO_BOM"; materials: [] }
  | { lineStatus: MaterialLineStatus; materials: MaterialCheckLine[] };

/** Rolls up per-ingredient checks to one line-level status: SHORT beats UNMAPPED beats READY,
 * since a confirmed shortage is a stronger signal than "we simply can't verify this one yet". */
export function rollUpMaterialStatus(materials: MaterialCheckLine[]): MaterialLineStatus {
  if (materials.some((m) => m.status === "SHORT")) return "SHORT";
  if (materials.some((m) => m.status === "UNMAPPED")) return "UNMAPPED";
  return "READY";
}

/** Compares a required quantity against a live ledger StockSummary (AVAILABLE bucket) —
 * the same summary getItemStockSummary() already computes for the Warehouse module. */
export function checkIngredientAgainstStock(requiredQtyKg: number, stock: StockSummary): { status: MaterialLineStatus; shortageQty: number | null } {
  const available = stock.AVAILABLE;
  if (available >= requiredQtyKg) return { status: "READY", shortageQty: null };
  return { status: "SHORT", shortageQty: Math.round((requiredQtyKg - available) * 1000) / 1000 };
}

const TERMINAL_STATUSES: CustomerOrderStatus[] = ["DISPATCHED", "DELIVERED", "CLOSED", "CANCELLED"];

export type OrderRisk = {
  overdue: boolean;
  atRisk: boolean;
  reasons: string[];
};

/** Pure, render-time-only risk computation — mirrors this repo's existing convention of
 * never persisting a computed flag (yield%, reconciliation checks in Mfg Reconciliation
 * work the same way) so it can never drift out of sync with the real order/material state. */
export function computeOrderRisk(order: {
  status: CustomerOrderStatus;
  requestedDeliveryDate: Date;
  confirmedDeliveryDate: Date | null;
  lineMaterialStatuses: MaterialLineStatus[];
}): OrderRisk {
  const reasons: string[] = [];
  const isTerminal = TERMINAL_STATUSES.includes(order.status);

  const dueDate = order.confirmedDeliveryDate ?? order.requestedDeliveryDate;
  const overdue = !isTerminal && dueDate.getTime() < Date.now();
  if (overdue) reasons.push("Past its delivery date and not yet dispatched");

  const shortCount = order.lineMaterialStatuses.filter((s) => s === "SHORT").length;
  const unmappedCount = order.lineMaterialStatuses.filter((s) => s === "UNMAPPED").length;
  if (!isTerminal && shortCount > 0) reasons.push(`${shortCount} line${shortCount === 1 ? "" : "s"} short on raw material`);
  if (!isTerminal && unmappedCount > 0 && shortCount === 0) reasons.push(`${unmappedCount} line${unmappedCount === 1 ? "" : "s"} can't be auto-verified (ingredients not mapped to stock items)`);

  const daysToDue = (dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  const atRisk = !isTerminal && (overdue || (shortCount > 0 && daysToDue <= 7));

  return { overdue, atRisk, reasons };
}

/** Human-friendly order number, e.g. CO-2026-00042 — sequence is per-calendar-year, counted
 * by the caller (needs a DB read) and formatted here. */
export function formatOrderNumber(year: number, sequence: number): string {
  return `CO-${year}-${String(sequence).padStart(5, "0")}`;
}

export const CUSTOMER_ORDER_STATUS_LABELS: Record<CustomerOrderStatus, string> = {
  DRAFT: "Draft",
  RECEIVED: "Received",
  UNDER_REVIEW: "Under Review",
  MATERIAL_CHECK: "Material Check",
  CONFIRMED: "Confirmed",
  IN_PRODUCTION: "In Production",
  QA_QC: "QA / QC",
  READY_TO_DISPATCH: "Ready to Dispatch",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  CLOSED: "Closed",
  ON_HOLD: "On Hold",
  CANCELLED: "Cancelled",
};

/** The main forward path a planner walks an order through — used to render "next status"
 * suggestions. ON_HOLD/CANCELLED are reachable from anywhere and not part of this list. */
export const CUSTOMER_ORDER_STATUS_SEQUENCE: CustomerOrderStatus[] = [
  "DRAFT",
  "RECEIVED",
  "UNDER_REVIEW",
  "MATERIAL_CHECK",
  "CONFIRMED",
  "IN_PRODUCTION",
  "QA_QC",
  "READY_TO_DISPATCH",
  "DISPATCHED",
  "DELIVERED",
  "CLOSED",
];
