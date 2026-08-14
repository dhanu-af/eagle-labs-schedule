"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canManageMaterialShortages } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { scaleIngredientQtyKg, checkIngredientAgainstStock } from "@/lib/customer-order-defaults";
import { getItemStockSummary } from "@/lib/warehouse-ledger";
import { getOpenPurchaseOrderLinesForItems, type IncomingPoInfo } from "@/lib/actions/procurement-actions";
import { computeShortageRiskLevel } from "@/lib/material-shortage-defaults";
import type { ActionLogStatus, EscalationLevel } from "@/generated/prisma";

const BASE_PATH = "/material-shortages";

async function requireAccess() {
  const session = await getSession();
  if (!session || !canManageMaterialShortages(session.role)) throw new Error("Not authorized");
  return session;
}

export type MaterialShortageRow = {
  warehouseItemId: string;
  itemCode: string;
  itemName: string;
  unit: string;
  requiredQtyKg: number;
  availableQtyKg: number;
  netShortageKg: number;
  earliestNeedDate: string;
  riskLevel: EscalationLevel;
  affectedOrders: { orderNumber: string; requiredQtyKg: number }[];
  incomingPo: IncomingPoInfo | null;
  watchAction: string | null;
  watchOwner: string | null;
  watchStatus: ActionLogStatus | null;
};

/**
 * Nets material demand across EVERY active Customer Order at once, unlike
 * getOrderMaterialChecks() which deliberately checks one order at a time (see its
 * own comment about not netting -- this is that deferred MRP nuance, now built
 * for exactly this register). Only items that come out net-short are returned.
 */
export async function listMaterialShortages(): Promise<MaterialShortageRow[]> {
  const activeLines = await prisma.customerOrderLine.findMany({
    where: { customerOrder: { status: { notIn: ["DISPATCHED", "DELIVERED", "CLOSED", "CANCELLED"] } } },
    include: {
      customerOrder: { select: { orderNumber: true, requestedDeliveryDate: true, confirmedDeliveryDate: true } },
      product: { include: { formulation: { include: { ingredients: true } } } },
    },
  });

  type Accumulator = { requiredQtyKg: number; earliestNeedDate: Date; orders: Map<string, number> };
  const byItem = new Map<string, Accumulator>();

  for (const line of activeLines) {
    const formulation = line.product.formulation;
    if (!formulation) continue;
    const dueDate = line.customerOrder.confirmedDeliveryDate ?? line.customerOrder.requestedDeliveryDate;

    for (const ing of formulation.ingredients) {
      if (!ing.warehouseItemId) continue;
      const requiredQtyKg = scaleIngredientQtyKg(ing.baseQty, formulation, line);

      const acc = byItem.get(ing.warehouseItemId) ?? { requiredQtyKg: 0, earliestNeedDate: dueDate, orders: new Map() };
      acc.requiredQtyKg += requiredQtyKg;
      if (dueDate.getTime() < acc.earliestNeedDate.getTime()) acc.earliestNeedDate = dueDate;
      acc.orders.set(line.customerOrder.orderNumber, (acc.orders.get(line.customerOrder.orderNumber) ?? 0) + requiredQtyKg);
      byItem.set(ing.warehouseItemId, acc);
    }
  }

  if (byItem.size === 0) return [];

  const itemIds = Array.from(byItem.keys());
  const [items, incomingPos, watches] = await Promise.all([
    prisma.warehouseItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, itemCode: true, name: true, unit: true } }),
    getOpenPurchaseOrderLinesForItems(itemIds),
    prisma.materialShortageWatch.findMany({ where: { warehouseItemId: { in: itemIds } } }),
  ]);
  const itemById = new Map(items.map((i) => [i.id, i]));
  const watchByItemId = new Map(watches.map((w) => [w.warehouseItemId, w]));

  const computed = await Promise.all(
    Array.from(byItem.entries()).map(async ([itemId, acc]) => {
      const item = itemById.get(itemId);
      if (!item) return null; // inactive/deleted item -- shouldn't normally happen, skip rather than crash

      const stock = await getItemStockSummary(itemId);
      const { status, shortageQty } = checkIngredientAgainstStock(acc.requiredQtyKg, stock);
      if (status !== "SHORT" || !shortageQty) return null;

      const watch = watchByItemId.get(itemId);
      const row: MaterialShortageRow = {
        warehouseItemId: itemId,
        itemCode: item.itemCode,
        itemName: item.name,
        unit: item.unit,
        requiredQtyKg: Math.round(acc.requiredQtyKg * 1000) / 1000,
        availableQtyKg: stock.AVAILABLE,
        netShortageKg: shortageQty,
        earliestNeedDate: acc.earliestNeedDate.toISOString(),
        riskLevel: computeShortageRiskLevel(acc.earliestNeedDate),
        affectedOrders: Array.from(acc.orders.entries()).map(([orderNumber, requiredQtyKg]) => ({ orderNumber, requiredQtyKg: Math.round(requiredQtyKg * 1000) / 1000 })),
        incomingPo: incomingPos[itemId] ?? null,
        watchAction: watch?.action ?? null,
        watchOwner: watch?.owner ?? null,
        watchStatus: watch?.status ?? null,
      };
      return row;
    })
  );
  const rows = computed.filter((r): r is MaterialShortageRow => r != null);

  const riskOrder: Record<EscalationLevel, number> = { RED: 0, AMBER: 1, GREEN: 2 };
  rows.sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel] || new Date(a.earliestNeedDate).getTime() - new Date(b.earliestNeedDate).getTime());
  return rows;
}

export async function upsertShortageWatch(warehouseItemId: string, data: { action?: string | null; owner?: string | null; status: ActionLogStatus }) {
  const session = await requireAccess();

  const item = await prisma.warehouseItem.findUnique({ where: { id: warehouseItemId }, select: { name: true, itemCode: true } });
  if (!item) throw new Error("Warehouse item not found");

  const payload = { action: data.action?.trim() || null, owner: data.owner?.trim() || null, status: data.status, updatedById: session.userId, updatedByName: session.fullName };

  const watch = await prisma.materialShortageWatch.upsert({
    where: { warehouseItemId },
    create: { warehouseItemId, ...payload },
    update: payload,
  });

  await logAudit(session, {
    action: "SAVE_MATERIAL_SHORTAGE_WATCH",
    entityType: "MaterialShortageWatch",
    entityId: watch.id,
    summary: `Shortage watch for ${item.name} (${item.itemCode}) set to ${data.status}${data.owner ? `, owner ${data.owner}` : ""}`,
  });

  revalidatePath(BASE_PATH);
  return watch;
}
