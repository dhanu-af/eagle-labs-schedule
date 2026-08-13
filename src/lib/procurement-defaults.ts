import type { PurchaseOrderStatus } from "@/generated/prisma";

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  CONFIRMED: "Confirmed",
  PARTIALLY_RECEIVED: "Partially Received",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
};

/** A PO still counts as "on order" for material-check matching purposes unless it's
 * fully received or cancelled -- PARTIALLY_RECEIVED still means more is coming. */
export function isOpenPoStatus(status: PurchaseOrderStatus): boolean {
  return status !== "RECEIVED" && status !== "CANCELLED";
}
