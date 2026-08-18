"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canManagePurchasing, type SessionPayload } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { PurchaseOrderStatus } from "@/generated/prisma";

const BASE_PATH = "/procurement";

async function requireAccess() {
  const session = await getSession();
  if (!session || !canManagePurchasing(session.role)) throw new Error("Not authorized");
  return session;
}

async function nextPoNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.purchaseOrder.count({ where: { poNumber: { startsWith: `PO-${year}-` } } });
  return `PO-${year}-${String(count + 1).padStart(5, "0")}`;
}

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

export async function listSuppliers() {
  return prisma.supplier.findMany({ orderBy: { name: "asc" } });
}

export async function createSupplier(data: {
  code: string;
  name: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  leadTimeDays?: number | null;
  notes?: string | null;
}) {
  const session = await requireAccess();
  if (!data.code.trim() || !data.name.trim()) throw new Error("Supplier code and name are required");

  const supplier = await prisma.supplier.create({ data: { ...data, code: data.code.trim(), name: data.name.trim() } });

  await logAudit(session, { action: "CREATE_SUPPLIER", entityType: "Supplier", entityId: supplier.id, summary: `Supplier "${supplier.name}" (${supplier.code}) added` });
  revalidatePath(BASE_PATH);
  return supplier;
}

export async function updateSupplier(
  id: string,
  data: { code: string; name: string; contactName?: string | null; contactEmail?: string | null; contactPhone?: string | null; leadTimeDays?: number | null; notes?: string | null; active: boolean }
) {
  const session = await requireAccess();
  if (!data.code.trim() || !data.name.trim()) throw new Error("Supplier code and name are required");

  const supplier = await prisma.supplier.update({ where: { id }, data: { ...data, code: data.code.trim(), name: data.name.trim() } });

  await logAudit(session, { action: "UPDATE_SUPPLIER", entityType: "Supplier", entityId: supplier.id, summary: `Supplier "${supplier.name}" (${supplier.code}) updated` });
  revalidatePath(BASE_PATH);
  return supplier;
}

// ---------------------------------------------------------------------------
// Purchase Orders
// ---------------------------------------------------------------------------

export type NewPoLineInput = { itemId: string; quantity: number; unit: string; notes?: string | null };

export async function createPurchaseOrder(data: {
  supplierId: string;
  expectedDeliveryDate: string;
  notes?: string | null;
  lines: NewPoLineInput[];
}) {
  const session = await requireAccess();
  if (!data.supplierId) throw new Error("Supplier is required");
  if (!data.lines.length) throw new Error("At least one line is required");
  for (const line of data.lines) {
    if (!line.itemId) throw new Error("Every line needs an item");
    if (!line.quantity || line.quantity <= 0) throw new Error("Every line needs a quantity greater than 0");
  }

  const poNumber = await nextPoNumber();

  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      supplierId: data.supplierId,
      expectedDeliveryDate: new Date(data.expectedDeliveryDate),
      notes: data.notes,
      createdById: session.userId,
      createdByName: session.fullName,
      lines: { create: data.lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity, unit: l.unit, notes: l.notes })) },
    },
    include: { lines: true, supplier: true },
  });

  await logAudit(session, {
    action: "CREATE_PURCHASE_ORDER",
    entityType: "PurchaseOrder",
    entityId: po.id,
    summary: `PO ${po.poNumber} to ${po.supplier.name} created (${po.lines.length} line${po.lines.length === 1 ? "" : "s"}), expected ${data.expectedDeliveryDate}`,
  });

  revalidatePath(BASE_PATH);
  return po;
}

const VALID_PO_STATUSES: PurchaseOrderStatus[] = ["DRAFT", "SENT", "CONFIRMED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"];

export async function updatePurchaseOrderStatus(id: string, status: PurchaseOrderStatus) {
  const session = await requireAccess();
  if (!VALID_PO_STATUSES.includes(status)) throw new Error("Unknown status");

  const before = await prisma.purchaseOrder.findUnique({ where: { id }, select: { poNumber: true, status: true } });
  if (!before) throw new Error("Purchase order not found");

  const po = await prisma.purchaseOrder.update({ where: { id }, data: { status } });

  await logAudit(session, {
    action: "UPDATE_PURCHASE_ORDER_STATUS",
    entityType: "PurchaseOrder",
    entityId: po.id,
    summary: `PO ${po.poNumber} moved from ${before.status} to ${status}`,
  });

  revalidatePath(BASE_PATH);
  return po;
}

export async function listPurchaseOrders() {
  return prisma.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: { supplier: true, lines: { include: { item: { select: { name: true, itemCode: true, unit: true } } } } },
  });
}

// ---------------------------------------------------------------------------
// Cross-module: consumed by customer-order-actions.ts's getOrderMaterialChecks so a
// shortage can point at a real incoming PO instead of a dead end. One-way dependency
// only -- this file never imports from customer-order-actions.ts.
// ---------------------------------------------------------------------------

export type IncomingPoInfo = { poNumber: string; supplierName: string; quantity: number; expectedDeliveryDate: string };

/** For each of the given WarehouseItem ids, the earliest-arriving still-open (not
 * RECEIVED/CANCELLED) Purchase Order line for that item, if any -- one query, not one
 * per item. */
export async function getOpenPurchaseOrderLinesForItems(itemIds: string[]): Promise<Record<string, IncomingPoInfo>> {
  if (itemIds.length === 0) return {};

  const lines = await prisma.purchaseOrderLine.findMany({
    where: { itemId: { in: itemIds }, purchaseOrder: { status: { notIn: ["RECEIVED", "CANCELLED"] } } },
    include: { purchaseOrder: { include: { supplier: true } } },
    orderBy: { purchaseOrder: { expectedDeliveryDate: "asc" } },
  });

  const result: Record<string, IncomingPoInfo> = {};
  for (const line of lines) {
    if (result[line.itemId]) continue; // already have the earliest for this item (rows arrive sorted by expectedDeliveryDate)
    result[line.itemId] = {
      poNumber: line.purchaseOrder.poNumber,
      supplierName: line.purchaseOrder.supplier.name,
      quantity: line.quantity,
      expectedDeliveryDate: line.purchaseOrder.expectedDeliveryDate.toISOString(),
    };
  }
  return result;
}

/** For the "New Goods Receiving" PO picker -- every PO that could plausibly still receive
 * stock against it (not yet fully RECEIVED, not CANCELLED). */
export async function listOpenPurchaseOrdersForReceiving() {
  const orders = await prisma.purchaseOrder.findMany({
    where: { status: { notIn: ["RECEIVED", "CANCELLED"] } },
    orderBy: { expectedDeliveryDate: "asc" },
    include: { supplier: true, lines: { include: { item: { select: { name: true, itemCode: true } } } } },
  });
  return orders.map((po) => ({
    id: po.id,
    poNumber: po.poNumber,
    supplierName: po.supplier.name,
    lines: po.lines.map((l) => ({ itemId: l.itemId, itemName: l.item.name, itemCode: l.item.itemCode, quantity: l.quantity, unit: l.unit })),
  }));
}

/**
 * Recomputes and applies a PO's status from real Goods Receiving data linked to it --
 * called after any goods-receiving-side event (new receiving created, a line rejected, a
 * receiving deleted) that could change how much of the PO has actually arrived. Rejected
 * lines don't count as received. Only ever moves a PO into PARTIALLY_RECEIVED/RECEIVED --
 * never overrides DRAFT/CANCELLED, since "nothing sent yet" and "this was cancelled" aren't
 * states a goods receipt should silently reverse.
 */
export async function recomputePurchaseOrderStatus(purchaseOrderId: string, session: SessionPayload) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: purchaseOrderId }, include: { lines: true } });
  if (!po) return;
  if (po.status === "DRAFT" || po.status === "CANCELLED") return;

  const receivedLines = await prisma.goodsReceivingLine.findMany({
    where: { goodsReceiving: { purchaseOrderId }, status: { not: "REJECTED" } },
    select: { itemId: true, quantity: true },
  });

  const receivedByItem = new Map<string, number>();
  for (const l of receivedLines) {
    receivedByItem.set(l.itemId, (receivedByItem.get(l.itemId) ?? 0) + l.quantity);
  }

  const anyReceived = receivedByItem.size > 0;
  if (!anyReceived) return; // nothing received (or everything since rejected/removed) -- don't guess at reverting a status change we can't be sure of

  const allFulfilled = po.lines.every((line) => (receivedByItem.get(line.itemId) ?? 0) >= line.quantity);
  const newStatus: PurchaseOrderStatus = allFulfilled ? "RECEIVED" : "PARTIALLY_RECEIVED";

  if (newStatus === po.status) return;

  await prisma.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { status: newStatus } });

  await logAudit(session, {
    action: "UPDATE_PURCHASE_ORDER_STATUS",
    entityType: "PurchaseOrder",
    entityId: po.id,
    summary: `PO ${po.poNumber} auto-updated from ${po.status} to ${newStatus} based on goods receiving`,
  });

  revalidatePath(BASE_PATH);
}
