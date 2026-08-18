"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canManageCustomerOrders, isAdminRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getItemStockSummary } from "@/lib/warehouse-ledger";
import { getOpenPurchaseOrderLinesForItems } from "@/lib/actions/procurement-actions";
import {
  scaleIngredientQtyKg,
  checkIngredientAgainstStock,
  rollUpMaterialStatus,
  formatOrderNumber,
  computeOrderRisk,
  computeLineQaStatus,
  computeOrderQaStatus,
  QA_GATE_STATUS_LABELS,
  QA_GATED_STATUSES,
  CUSTOMER_ORDER_STATUS_LABELS,
  type MaterialCheckResult,
  type MaterialCheckLine,
  type MaterialLineStatus,
  type QaGateStatus,
  type ContestingOrder,
} from "@/lib/customer-order-defaults";
import type { CustomerOrderStatus } from "@/generated/prisma";

const BASE_PATH = "/customer-orders";

async function requireAccess() {
  const session = await getSession();
  if (!session || !canManageCustomerOrders(session.role)) throw new Error("Not authorized");
  return session;
}

async function nextOrderNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.customerOrder.count({
    where: { orderNumber: { startsWith: `CO-${year}-` } },
  });
  return formatOrderNumber(year, count + 1);
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export async function listCustomers() {
  return prisma.customer.findMany({ orderBy: { name: "asc" } });
}

export async function createCustomer(data: {
  code: string;
  name: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  notes?: string | null;
}) {
  const session = await requireAccess();
  if (!data.code.trim() || !data.name.trim()) throw new Error("Customer code and name are required");

  const customer = await prisma.customer.create({ data: { ...data, code: data.code.trim(), name: data.name.trim() } });

  await logAudit(session, {
    action: "CREATE_CUSTOMER",
    entityType: "Customer",
    entityId: customer.id,
    summary: `Customer "${customer.name}" (${customer.code}) created`,
  });

  revalidatePath(BASE_PATH);
  return customer;
}

export async function updateCustomer(
  id: string,
  data: {
    code: string;
    name: string;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    address?: string | null;
    notes?: string | null;
    active: boolean;
  }
) {
  const session = await requireAccess();
  if (!data.code.trim() || !data.name.trim()) throw new Error("Customer code and name are required");

  const customer = await prisma.customer.update({
    where: { id },
    data: { ...data, code: data.code.trim(), name: data.name.trim() },
  });

  await logAudit(session, {
    action: "UPDATE_CUSTOMER",
    entityType: "Customer",
    entityId: customer.id,
    summary: `Customer "${customer.name}" (${customer.code}) updated`,
  });

  revalidatePath(BASE_PATH);
  return customer;
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function listProducts() {
  return prisma.product.findMany({
    orderBy: { name: "asc" },
    include: { formulation: { select: { id: true, productName: true, baseBatchSize: true, baseUnit: true } } },
  });
}

export async function getFormulationsForProductPicker() {
  return prisma.formulation.findMany({
    select: { id: true, productName: true, baseBatchSize: true, baseUnit: true },
    orderBy: { productName: "asc" },
  });
}

export async function createProduct(data: {
  sku: string;
  name: string;
  category?: string | null;
  defaultUnit: string;
  formulationId?: string | null;
}) {
  const session = await requireAccess();
  if (!data.sku.trim() || !data.name.trim()) throw new Error("SKU and name are required");

  const product = await prisma.product.create({
    data: { ...data, sku: data.sku.trim(), name: data.name.trim(), createdById: session.userId, createdByName: session.fullName },
  });

  await logAudit(session, {
    action: "CREATE_PRODUCT",
    entityType: "Product",
    entityId: product.id,
    summary: `Product "${product.name}" (${product.sku}) created`,
  });

  revalidatePath(BASE_PATH);
  return product;
}

export async function updateProduct(
  id: string,
  data: { sku: string; name: string; category?: string | null; defaultUnit: string; formulationId?: string | null; active: boolean }
) {
  const session = await requireAccess();
  if (!data.sku.trim() || !data.name.trim()) throw new Error("SKU and name are required");

  const product = await prisma.product.update({
    where: { id },
    data: { ...data, sku: data.sku.trim(), name: data.name.trim() },
  });

  await logAudit(session, {
    action: "UPDATE_PRODUCT",
    entityType: "Product",
    entityId: product.id,
    summary: `Product "${product.name}" (${product.sku}) updated`,
  });

  revalidatePath(BASE_PATH);
  return product;
}

// ---------------------------------------------------------------------------
// Material availability check — reuses the existing warehouse ledger, no new
// inventory logic. See src/lib/customer-order-defaults.ts for the pure math.
// ---------------------------------------------------------------------------

export async function checkMaterialAvailability(lineId: string): Promise<MaterialCheckResult> {
  const line = await prisma.customerOrderLine.findUnique({
    where: { id: lineId },
    include: { product: { include: { formulation: { include: { ingredients: true } } } } },
  });
  if (!line) throw new Error("Order line not found");

  const formulation = line.product.formulation;
  if (!formulation) return { lineStatus: "NO_BOM", materials: [] };

  const materials: MaterialCheckLine[] = await Promise.all(
    formulation.ingredients.map(async (ing) => {
      const requiredQtyKg = scaleIngredientQtyKg(ing.baseQty, formulation, line);

      if (!ing.warehouseItemId) {
        return {
          ingredientName: ing.ingredientName,
          rmNumber: ing.rmNumber,
          warehouseItemId: null,
          requiredQtyKg,
          availableQty: null,
          shortageQty: null,
          status: "UNMAPPED" as const,
          incomingPo: null,
          contestedBy: [],
        };
      }

      const stock = await getItemStockSummary(ing.warehouseItemId);
      const { status, shortageQty } = checkIngredientAgainstStock(requiredQtyKg, stock);
      return {
        ingredientName: ing.ingredientName,
        rmNumber: ing.rmNumber,
        warehouseItemId: ing.warehouseItemId,
        requiredQtyKg,
        availableQty: stock.AVAILABLE,
        shortageQty,
        status,
        incomingPo: null,
        contestedBy: [],
      };
    })
  );

  await attachIncomingPos(materials);
  const itemIds = Array.from(new Set(materials.filter((m) => m.warehouseItemId).map((m) => m.warehouseItemId as string)));
  const contestingByItemId = await getContestingDemand(itemIds, line.customerOrderId);
  for (const m of materials) {
    if (m.warehouseItemId && contestingByItemId[m.warehouseItemId]) m.contestedBy = contestingByItemId[m.warehouseItemId];
  }

  return { lineStatus: rollUpMaterialStatus(materials), materials };
}

/** Mutates SHORT materials in place, attaching the earliest open PO covering their stock
 * item (if any) -- one batched lookup shared across every SHORT ingredient passed in, so
 * a multi-line order doesn't turn into one procurement query per ingredient. */
async function attachIncomingPos(materials: MaterialCheckLine[]) {
  const shortItemIds = Array.from(new Set(materials.filter((m) => m.status === "SHORT" && m.warehouseItemId).map((m) => m.warehouseItemId as string)));
  if (shortItemIds.length === 0) return;

  const incomingByItemId = await getOpenPurchaseOrderLinesForItems(shortItemIds);
  for (const m of materials) {
    if (m.status === "SHORT" && m.warehouseItemId && incomingByItemId[m.warehouseItemId]) {
      m.incomingPo = incomingByItemId[m.warehouseItemId];
    }
  }
}

/** For a set of warehouse items, the demand every OTHER active order places on them
 * (excluding `excludeOrderId`) -- the cross-order netting signal getOrderMaterialChecks'
 * own comment flags as intentionally deferred. Doesn't change any line's own READY/SHORT
 * status (still "can THIS order be covered right now") -- purely an additional "heads up,
 * these other orders are drawing on the same pool" signal, same underlying computation
 * listMaterialShortages() already does across every order at once. */
async function getContestingDemand(itemIds: string[], excludeOrderId: string): Promise<Record<string, ContestingOrder[]>> {
  if (itemIds.length === 0) return {};

  const otherLines = await prisma.customerOrderLine.findMany({
    where: {
      customerOrderId: { not: excludeOrderId },
      customerOrder: { status: { notIn: ["DISPATCHED", "DELIVERED", "CLOSED", "CANCELLED"] } },
    },
    include: {
      customerOrder: { select: { orderNumber: true } },
      product: { include: { formulation: { include: { ingredients: true } } } },
    },
  });

  const byItem = new Map<string, Map<string, number>>();
  for (const line of otherLines) {
    const formulation = line.product.formulation;
    if (!formulation) continue;
    for (const ing of formulation.ingredients) {
      if (!ing.warehouseItemId || !itemIds.includes(ing.warehouseItemId)) continue;
      const requiredQtyKg = scaleIngredientQtyKg(ing.baseQty, formulation, line);
      const perOrder = byItem.get(ing.warehouseItemId) ?? new Map<string, number>();
      perOrder.set(line.customerOrder.orderNumber, (perOrder.get(line.customerOrder.orderNumber) ?? 0) + requiredQtyKg);
      byItem.set(ing.warehouseItemId, perOrder);
    }
  }

  const result: Record<string, ContestingOrder[]> = {};
  for (const [itemId, perOrder] of byItem) {
    result[itemId] = Array.from(perOrder.entries()).map(([orderNumber, requiredQtyKg]) => ({
      orderNumber,
      requiredQtyKg: Math.round(requiredQtyKg * 1000) / 1000,
    }));
  }
  return result;
}

/** Same check as checkMaterialAvailability, but for every line on an order at once, sharing
 * one stock-summary lookup per distinct warehouse item across all of them instead of
 * re-querying the ledger per line -- this is what the order detail page and the dashboard's
 * risk overview both call, so a multi-line order (or a dashboard with many active orders)
 * doesn't turn into an N+1 query storm. Each line's own READY/SHORT status is still computed
 * against this order alone (not netted against other orders -- see getContestingDemand's own
 * comment); `contestedBy` is attached separately as an additional signal, not a status change. */
export async function getOrderMaterialChecks(orderId: string): Promise<Record<string, MaterialCheckResult>> {
  const order = await prisma.customerOrder.findUnique({
    where: { id: orderId },
    include: { lines: { include: { product: { include: { formulation: { include: { ingredients: true } } } } } } },
  });
  if (!order) throw new Error("Order not found");

  const warehouseItemIds = Array.from(
    new Set(
      order.lines.flatMap((line) => line.product.formulation?.ingredients.map((i) => i.warehouseItemId).filter((id): id is string => !!id) ?? [])
    )
  );
  const stockEntries = await Promise.all(warehouseItemIds.map(async (id) => [id, await getItemStockSummary(id)] as const));
  const stockByItemId = new Map(stockEntries);

  const result: Record<string, MaterialCheckResult> = {};
  for (const line of order.lines) {
    const formulation = line.product.formulation;
    if (!formulation) {
      result[line.id] = { lineStatus: "NO_BOM", materials: [] };
      continue;
    }

    const materials: MaterialCheckLine[] = formulation.ingredients.map((ing) => {
      const requiredQtyKg = scaleIngredientQtyKg(ing.baseQty, formulation, line);
      const stock = ing.warehouseItemId ? stockByItemId.get(ing.warehouseItemId) : undefined;

      if (!stock) {
        return { ingredientName: ing.ingredientName, rmNumber: ing.rmNumber, warehouseItemId: ing.warehouseItemId, requiredQtyKg, availableQty: null, shortageQty: null, status: "UNMAPPED" as const, incomingPo: null, contestedBy: [] };
      }

      const { status, shortageQty } = checkIngredientAgainstStock(requiredQtyKg, stock);
      return { ingredientName: ing.ingredientName, rmNumber: ing.rmNumber, warehouseItemId: ing.warehouseItemId, requiredQtyKg, availableQty: stock.AVAILABLE, shortageQty, status, incomingPo: null, contestedBy: [] };
    });

    result[line.id] = { lineStatus: rollUpMaterialStatus(materials), materials };
  }

  await attachIncomingPos(Object.values(result).flatMap((r) => r.materials));

  const contestingByItemId = await getContestingDemand(warehouseItemIds, orderId);
  for (const r of Object.values(result)) {
    for (const m of r.materials) {
      if (m.warehouseItemId && contestingByItemId[m.warehouseItemId]) m.contestedBy = contestingByItemId[m.warehouseItemId];
    }
  }

  return result;
}

/** Feeds the dashboard's risk overview — every non-terminal order's real material check plus
 * computeOrderRisk's date/status logic, batched per order via getOrderMaterialChecks. */
export async function getActiveOrdersWithRisk() {
  const orders = await prisma.customerOrder.findMany({
    where: { status: { notIn: ["DISPATCHED", "DELIVERED", "CLOSED", "CANCELLED"] } },
    orderBy: { requestedDeliveryDate: "asc" },
    include: {
      customer: { select: { name: true } },
      lines: { include: { batchRecords: { include: { qcSamples: { select: { sampleType: true, status: true } } } } } },
    },
  });

  const withRisk = await Promise.all(
    orders.map(async (order) => {
      const checks = order.lines.length ? await getOrderMaterialChecks(order.id) : {};
      const lineMaterialStatuses: MaterialLineStatus[] = Object.values(checks).map((c) => (c.lineStatus === "NO_BOM" ? "UNMAPPED" : c.lineStatus));
      const shortLineCount = lineMaterialStatuses.filter((s) => s === "SHORT").length;
      const risk = computeOrderRisk({
        status: order.status,
        requestedDeliveryDate: order.requestedDeliveryDate,
        confirmedDeliveryDate: order.confirmedDeliveryDate,
        lineMaterialStatuses,
      });
      const qaStatus = computeOrderQaStatus(order.lines.map((l) => computeLineQaStatus(l.batchRecords)));
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customer.name,
        status: order.status,
        priority: order.priority,
        requestedDeliveryDate: order.requestedDeliveryDate.toISOString(),
        confirmedDeliveryDate: order.confirmedDeliveryDate?.toISOString() ?? null,
        risk,
        qaStatus,
        shortLineCount,
      };
    })
  );

  return withRisk;
}

// ---------------------------------------------------------------------------
// Customer Orders
// ---------------------------------------------------------------------------

export type NewOrderLineInput = { productId: string; quantity: number; unit: string; packagingRequirement?: string | null; artworkStatus?: string | null; notes?: string | null };

export async function createCustomerOrder(data: {
  customerId: string;
  customerPoNumber?: string | null;
  customerRequestNumber?: string | null;
  requestedDeliveryDate: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  shippingRequirements?: string | null;
  specialRequirements?: string | null;
  notes?: string | null;
  lines: NewOrderLineInput[];
}) {
  const session = await requireAccess();
  if (!data.customerId) throw new Error("Customer is required");
  if (!data.lines.length) throw new Error("At least one order line is required");
  for (const line of data.lines) {
    if (!line.productId) throw new Error("Every line needs a product");
    if (!line.quantity || line.quantity <= 0) throw new Error("Every line needs a quantity greater than 0");
  }

  const orderNumber = await nextOrderNumber();

  const order = await prisma.customerOrder.create({
    data: {
      orderNumber,
      customerId: data.customerId,
      customerPoNumber: data.customerPoNumber,
      customerRequestNumber: data.customerRequestNumber,
      requestedDeliveryDate: new Date(data.requestedDeliveryDate),
      priority: data.priority,
      shippingRequirements: data.shippingRequirements,
      specialRequirements: data.specialRequirements,
      notes: data.notes,
      createdById: session.userId,
      createdByName: session.fullName,
      lines: {
        create: data.lines.map((line, i) => ({
          lineNumber: i + 1,
          productId: line.productId,
          quantity: line.quantity,
          unit: line.unit,
          packagingRequirement: line.packagingRequirement,
          artworkStatus: line.artworkStatus,
          notes: line.notes,
        })),
      },
    },
    include: { lines: true, customer: true },
  });

  await logAudit(session, {
    action: "CREATE_CUSTOMER_ORDER",
    entityType: "CustomerOrder",
    entityId: order.id,
    summary: `Order ${order.orderNumber} for ${order.customer.name} created (${order.lines.length} line${order.lines.length === 1 ? "" : "s"})`,
  });

  revalidatePath(BASE_PATH);
  return order;
}

export async function updateCustomerOrder(
  id: string,
  data: {
    customerPoNumber?: string | null;
    customerRequestNumber?: string | null;
    requestedDeliveryDate: string;
    confirmedDeliveryDate?: string | null;
    priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
    responsiblePlannerId?: string | null;
    salesOwnerId?: string | null;
    shippingRequirements?: string | null;
    specialRequirements?: string | null;
    notes?: string | null;
  }
) {
  const session = await requireAccess();

  const order = await prisma.customerOrder.update({
    where: { id },
    data: {
      customerPoNumber: data.customerPoNumber,
      customerRequestNumber: data.customerRequestNumber,
      requestedDeliveryDate: new Date(data.requestedDeliveryDate),
      confirmedDeliveryDate: data.confirmedDeliveryDate ? new Date(data.confirmedDeliveryDate) : null,
      priority: data.priority,
      responsiblePlannerId: data.responsiblePlannerId,
      salesOwnerId: data.salesOwnerId,
      shippingRequirements: data.shippingRequirements,
      specialRequirements: data.specialRequirements,
      notes: data.notes,
    },
  });

  await logAudit(session, {
    action: "UPDATE_CUSTOMER_ORDER",
    entityType: "CustomerOrder",
    entityId: order.id,
    summary: `Order ${order.orderNumber} updated`,
  });

  revalidatePath(BASE_PATH);
  revalidatePath(`${BASE_PATH}/${id}`);
  return order;
}

const VALID_STATUSES: CustomerOrderStatus[] = [
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
  "ON_HOLD",
  "CANCELLED",
];

/** Per-line and order-level QA status, rolled up from each line's linked Batch Records'
 * FINISHED_PRODUCT QC samples. Exported so both updateOrderStatus's gate and the order
 * detail page's display use the exact same computation and can never disagree. */
export async function getOrderQaStatus(orderId: string): Promise<{ lineStatuses: Record<string, QaGateStatus>; orderStatus: QaGateStatus }> {
  const order = await prisma.customerOrder.findUnique({
    where: { id: orderId },
    include: { lines: { include: { batchRecords: { include: { qcSamples: { select: { sampleType: true, status: true } } } } } } },
  });
  if (!order) throw new Error("Order not found");

  const lineStatuses: Record<string, QaGateStatus> = {};
  for (const line of order.lines) {
    lineStatuses[line.id] = computeLineQaStatus(line.batchRecords);
  }
  return { lineStatuses, orderStatus: computeOrderQaStatus(Object.values(lineStatuses)) };
}

export async function updateOrderStatus(
  id: string,
  status: CustomerOrderStatus,
  options?: { reason?: string | null; qaOverride?: boolean }
) {
  const session = await requireAccess();
  if (!VALID_STATUSES.includes(status)) throw new Error("Unknown status");

  const before = await prisma.customerOrder.findUnique({ where: { id }, select: { orderNumber: true, status: true } });
  if (!before) throw new Error("Order not found");

  let qaOverrideApplied = false;
  if (QA_GATED_STATUSES.includes(status)) {
    const { orderStatus: qaStatus } = await getOrderQaStatus(id);
    if (qaStatus !== "RELEASED") {
      if (!options?.qaOverride) {
        throw new Error(
          `Can't move to ${CUSTOMER_ORDER_STATUS_LABELS[status]} — ${QA_GATE_STATUS_LABELS[qaStatus]}. An Admin/Super Admin can override this with a reason.`
        );
      }
      if (!isAdminRole(session.role)) throw new Error("Only an Admin or Super Admin can override a QA hold");
      if (!options.reason?.trim()) throw new Error("An override reason is required");
      qaOverrideApplied = true;
    }
  }

  const order = await prisma.customerOrder.update({ where: { id }, data: { status } });

  await logAudit(session, {
    action: "UPDATE_CUSTOMER_ORDER_STATUS",
    entityType: "CustomerOrder",
    entityId: order.id,
    summary: `Order ${order.orderNumber} moved from ${before.status} to ${status}${
      qaOverrideApplied ? ` — QA HOLD OVERRIDDEN: ${options?.reason}` : options?.reason ? ` — ${options.reason}` : ""
    }`,
  });

  revalidatePath(BASE_PATH);
  revalidatePath(`${BASE_PATH}/${id}`);
  return order;
}

export async function addOrderLine(orderId: string, line: NewOrderLineInput) {
  const session = await requireAccess();
  if (!line.productId) throw new Error("Product is required");
  if (!line.quantity || line.quantity <= 0) throw new Error("Quantity must be greater than 0");

  const existingCount = await prisma.customerOrderLine.count({ where: { customerOrderId: orderId } });
  const created = await prisma.customerOrderLine.create({
    data: { customerOrderId: orderId, lineNumber: existingCount + 1, ...line },
  });

  const order = await prisma.customerOrder.findUniqueOrThrow({ where: { id: orderId }, select: { orderNumber: true } });
  await logAudit(session, {
    action: "ADD_ORDER_LINE",
    entityType: "CustomerOrder",
    entityId: orderId,
    summary: `Line ${created.lineNumber} added to order ${order.orderNumber}`,
  });

  revalidatePath(`${BASE_PATH}/${orderId}`);
  return created;
}

export async function deleteOrderLine(lineId: string) {
  const session = await requireAccess();
  const line = await prisma.customerOrderLine.findUnique({
    where: { id: lineId },
    include: { customerOrder: { select: { id: true, orderNumber: true } }, batchRecords: { select: { id: true } } },
  });
  if (!line) throw new Error("Line not found");
  if (line.batchRecords.length > 0) throw new Error("Can't delete a line that already has a linked Batch Record");

  await prisma.customerOrderLine.delete({ where: { id: lineId } });

  await logAudit(session, {
    action: "DELETE_ORDER_LINE",
    entityType: "CustomerOrder",
    entityId: line.customerOrder.id,
    summary: `Line ${line.lineNumber} removed from order ${line.customerOrder.orderNumber}`,
  });

  revalidatePath(`${BASE_PATH}/${line.customerOrder.id}`);
}

export async function getBatchRecordsForLinking() {
  return prisma.batchRecord.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
    select: { id: true, productName: true, batchNumber: true, status: true, customerOrderLineId: true },
  });
}

export async function linkBatchRecordToLine(lineId: string, batchRecordId: string) {
  const session = await requireAccess();

  const line = await prisma.customerOrderLine.findUnique({
    where: { id: lineId },
    include: { customerOrder: { select: { id: true, orderNumber: true } } },
  });
  if (!line) throw new Error("Order line not found");

  const batch = await prisma.batchRecord.update({
    where: { id: batchRecordId },
    data: { customerOrderLineId: lineId },
  });

  await logAudit(session, {
    action: "LINK_BATCH_RECORD",
    entityType: "CustomerOrder",
    entityId: line.customerOrder.id,
    summary: `Batch ${batch.batchNumber} (${batch.productName}) linked to order ${line.customerOrder.orderNumber} line ${line.lineNumber}`,
  });

  revalidatePath(`${BASE_PATH}/${line.customerOrder.id}`);
  return batch;
}

export async function unlinkBatchRecord(batchRecordId: string) {
  const session = await requireAccess();

  const batch = await prisma.batchRecord.findUnique({
    where: { id: batchRecordId },
    include: { customerOrderLine: { include: { customerOrder: { select: { id: true, orderNumber: true } } } } },
  });
  if (!batch || !batch.customerOrderLine) throw new Error("Batch is not linked to an order");

  await prisma.batchRecord.update({ where: { id: batchRecordId }, data: { customerOrderLineId: null } });

  await logAudit(session, {
    action: "UNLINK_BATCH_RECORD",
    entityType: "CustomerOrder",
    entityId: batch.customerOrderLine.customerOrder.id,
    summary: `Batch ${batch.batchNumber} (${batch.productName}) unlinked from order ${batch.customerOrderLine.customerOrder.orderNumber}`,
  });

  revalidatePath(`${BASE_PATH}/${batch.customerOrderLine.customerOrder.id}`);
}

/** Global AuditLog filtered to this order, same convention as getMfgBatchAuditTrail. */
export async function getCustomerOrderAuditTrail(orderId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authorized");

  const entries = await prisma.auditLog.findMany({
    where: { entityType: "CustomerOrder", entityId: orderId },
    orderBy: { createdAt: "asc" },
  });

  return entries.map((e) => ({
    id: e.id,
    actorName: e.actorName,
    summary: e.summary,
    createdAt: e.createdAt.toISOString(),
  }));
}
