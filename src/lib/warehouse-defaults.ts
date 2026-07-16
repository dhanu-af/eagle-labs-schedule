import type {
  WarehouseItemCategory,
  WarehouseZone,
  GoodsReceivingLineStatus,
  WarehouseRequestStatus,
  ReceiptOutcome,
} from "@/generated/prisma";

export const CATEGORY_LABEL: Record<WarehouseItemCategory, string> = {
  RAW_MATERIAL: "Raw Material",
  PACKAGING: "Packaging",
  CONSUMABLE: "Consumable",
  FINISHED_GOOD: "Finished Good",
};

/** Suggested sub-categories per the module spec's master-data lists -- free text, not an enum, so these are starting suggestions only. */
export const CATEGORY_SUBCATEGORY_SUGGESTIONS: Record<WarehouseItemCategory, string[]> = {
  RAW_MATERIAL: ["Vitamins", "Minerals", "Botanical Extracts", "Probiotics", "Amino Acids", "Excipients", "Flavours"],
  PACKAGING: ["Capsules", "Bottles", "Caps", "Boxes", "Labels", "Desiccants", "Shrink Wrap", "Cartons", "Pouches", "Spoons"],
  CONSUMABLE: ["Gloves", "Hair Nets", "Cleaning Chemicals", "Alcohol", "Paper", "Markers", "Printer Labels", "Zip Ties"],
  FINISHED_GOOD: ["Gut AU", "Glyco AU", "Sleep AU", "Immune AU"],
};

export const ZONE_LABEL: Record<WarehouseZone, string> = {
  DRY_STORE: "Dry Store",
  COLD_STORE: "Cold Store",
  QUARANTINE: "Quarantine",
  RELEASED: "Released",
  REJECTED: "Rejected",
  PACKAGING: "Packaging",
  FINISHED_GOODS: "Finished Goods",
};

export const GR_LINE_STATUS_LABEL: Record<GoodsReceivingLineStatus, string> = {
  QUARANTINE: "Quarantine",
  RELEASED: "Released",
  REJECTED: "Rejected",
};

export const GR_LINE_STATUS_CLASS: Record<GoodsReceivingLineStatus, string> = {
  QUARANTINE: "bg-warning/10 text-warning border-warning/30",
  RELEASED: "bg-success/10 text-success border-success/30",
  REJECTED: "bg-danger/10 text-danger border-danger/30",
};

export const REQUEST_STATUS_LABEL: Record<WarehouseRequestStatus, string> = {
  REQUESTED: "Requested",
  WAREHOUSE_PREPARING: "Warehouse Preparing",
  RELEASED: "Released",
  WAITING_PRODUCTION_CONFIRMATION: "Waiting Production Confirmation",
  PARTIALLY_RECEIVED: "Partially Received",
  RECEIVED: "Received",
  IN_PRODUCTION: "In Production",
  RETURN_PENDING: "Return Pending",
  WAREHOUSE_VERIFYING: "Warehouse Verifying",
  COMPLETED: "Completed",
};

export const REQUEST_STATUS_CLASS: Record<WarehouseRequestStatus, string> = {
  REQUESTED: "bg-surface-muted text-muted-foreground border-border",
  WAREHOUSE_PREPARING: "bg-info/10 text-info border-info/30",
  RELEASED: "bg-info/10 text-info border-info/30",
  WAITING_PRODUCTION_CONFIRMATION: "bg-warning/10 text-warning border-warning/30",
  PARTIALLY_RECEIVED: "bg-danger/10 text-danger border-danger/30",
  RECEIVED: "bg-success/10 text-success border-success/30",
  IN_PRODUCTION: "bg-primary/10 text-primary border-primary/30",
  RETURN_PENDING: "bg-warning/10 text-warning border-warning/30",
  WAREHOUSE_VERIFYING: "bg-warning/10 text-warning border-warning/30",
  COMPLETED: "bg-success/10 text-success border-success/30",
};

export const RECEIPT_OUTCOME_LABEL: Record<ReceiptOutcome, string> = {
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  SHORTAGE: "Shortage",
  DAMAGED: "Damaged",
};

export type RequestViewerTier = "warehouse" | "production";

/** Whoever is viewing a request sees exactly one primary action, driven by status -- matching the module spec's 8-step lifecycle. Null = no action, request is closed. */
export const REQUEST_STATUS_ACTIONS: Record<WarehouseRequestStatus, { tier: RequestViewerTier; label: string } | null> = {
  REQUESTED: { tier: "warehouse", label: "Release to Production" },
  WAREHOUSE_PREPARING: { tier: "warehouse", label: "Release to Production" },
  RELEASED: { tier: "production", label: "Confirm Materials Received" },
  WAITING_PRODUCTION_CONFIRMATION: { tier: "production", label: "Confirm Materials Received" },
  PARTIALLY_RECEIVED: { tier: "production", label: "Confirm Materials Received" },
  RECEIVED: { tier: "production", label: "Send Return to Warehouse" },
  IN_PRODUCTION: { tier: "production", label: "Send Return to Warehouse" },
  RETURN_PENDING: { tier: "warehouse", label: "Confirm Return" },
  WAREHOUSE_VERIFYING: { tier: "warehouse", label: "Confirm Return" },
  COMPLETED: null,
};

/** Days until expiry (negative = already expired). Null when there's no expiry date. */
export function daysUntilExpiry(expiryDate: Date | string | null): number | null {
  if (!expiryDate) return null;
  const ms = new Date(expiryDate).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

/** 🟢/🟡/🔴 per the module spec's 30/60/90-day near-expiry thresholds. */
export function expiryIndicator(expiryDate: Date | string | null): "🟢" | "🟡" | "🔴" | null {
  const days = daysUntilExpiry(expiryDate);
  if (days === null) return null;
  if (days < 0) return "🔴";
  if (days <= 90) return "🟡";
  return "🟢";
}

export function isLowStock(available: number, minimumStock: number | null): boolean {
  return minimumStock !== null && available < minimumStock;
}
