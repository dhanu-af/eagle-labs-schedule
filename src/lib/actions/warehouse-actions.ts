"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canManageWarehouse } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { WarehouseItemCategory, WarehouseZone } from "@/generated/prisma";

async function requireWarehouseManagerAccess() {
  const session = await getSession();
  if (!session || !canManageWarehouse(session.role)) throw new Error("Not authorized");
  return session;
}

export async function createWarehouseItem(data: {
  itemCode: string;
  name: string;
  category: WarehouseItemCategory;
  subCategory: string | null;
  ingredientId: string | null;
  unit: string;
  minimumStock: number | null;
  maximumStock: number | null;
  defaultLocationId: string | null;
}) {
  const session = await requireWarehouseManagerAccess();
  if (!data.itemCode || !data.name || !data.unit) throw new Error("Item code, name, and unit are required");

  const item = await prisma.warehouseItem.create({
    data: { ...data, createdBy: session.fullName, updatedBy: session.fullName },
  });

  await logAudit(session, {
    action: "CREATE_WAREHOUSE_ITEM",
    entityType: "WarehouseItem",
    entityId: item.id,
    summary: `Added warehouse item ${data.name} (${data.itemCode})`,
  });

  revalidatePath("/warehouse");
}

export async function updateWarehouseItem(
  itemId: string,
  data: {
    name: string;
    category: WarehouseItemCategory;
    subCategory: string | null;
    unit: string;
    minimumStock: number | null;
    maximumStock: number | null;
    defaultLocationId: string | null;
    active: boolean;
  }
) {
  const session = await requireWarehouseManagerAccess();

  await prisma.warehouseItem.update({
    where: { id: itemId },
    data: { ...data, updatedBy: session.fullName },
  });

  await logAudit(session, {
    action: "UPDATE_WAREHOUSE_ITEM",
    entityType: "WarehouseItem",
    entityId: itemId,
    summary: `Updated warehouse item ${data.name}`,
  });

  revalidatePath("/warehouse");
}

/** Only allowed when the item has zero receiving/request/ledger history — deleting one that's actually
 * been used would either violate the DB's foreign key constraints or (if forced) silently corrupt
 * unrelated receivings/requests that reference it. Deactivate it instead if it's simply no longer used. */
export async function deleteWarehouseItem(id: string) {
  const session = await requireWarehouseManagerAccess();

  const [receivingLines, requestLines, ledgerEntries] = await Promise.all([
    prisma.goodsReceivingLine.count({ where: { itemId: id } }),
    prisma.warehouseRequestLine.count({ where: { itemId: id } }),
    prisma.materialLedgerEntry.count({ where: { itemId: id } }),
  ]);
  if (receivingLines + requestLines + ledgerEntries > 0) {
    throw new Error("Can't delete — this item has receiving, request, or ledger history. Deactivate it instead.");
  }

  const item = await prisma.warehouseItem.findUniqueOrThrow({ where: { id } });
  await prisma.warehouseItem.delete({ where: { id } });

  await logAudit(session, {
    action: "DELETE_WAREHOUSE_ITEM",
    entityType: "WarehouseItem",
    entityId: id,
    summary: `Deleted unused warehouse item ${item.name} (${item.itemCode})`,
  });

  revalidatePath("/warehouse");
}

export async function createWarehouseLocation(data: {
  code: string;
  label: string;
  zone: WarehouseZone;
  parentId: string | null;
}) {
  const session = await requireWarehouseManagerAccess();
  if (!data.code || !data.label) throw new Error("Location code and label are required");

  const location = await prisma.warehouseLocation.create({ data });

  await logAudit(session, {
    action: "CREATE_WAREHOUSE_LOCATION",
    entityType: "WarehouseLocation",
    entityId: location.id,
    summary: `Added warehouse location ${data.code} (${data.label})`,
  });

  revalidatePath("/warehouse");
}

export async function updateWarehouseLocation(
  locationId: string,
  data: { label: string; zone: WarehouseZone; parentId: string | null; active: boolean }
) {
  const session = await requireWarehouseManagerAccess();

  await prisma.warehouseLocation.update({ where: { id: locationId }, data });

  await logAudit(session, {
    action: "UPDATE_WAREHOUSE_LOCATION",
    entityType: "WarehouseLocation",
    entityId: locationId,
    summary: `Updated warehouse location ${data.label}`,
  });

  revalidatePath("/warehouse");
}

/** Only allowed when nothing references this location — as a default/release/return location, a
 * parent location, or in ledger history. Deactivate it instead if it's simply no longer used. */
export async function deleteWarehouseLocation(id: string) {
  const session = await requireWarehouseManagerAccess();

  const [items, children, receivingLines, releaseLines, returnLines, ledgerFrom, ledgerTo] = await Promise.all([
    prisma.warehouseItem.count({ where: { defaultLocationId: id } }),
    prisma.warehouseLocation.count({ where: { parentId: id } }),
    prisma.goodsReceivingLine.count({ where: { locationId: id } }),
    prisma.warehouseRequestLine.count({ where: { releaseLocationId: id } }),
    prisma.warehouseRequestLine.count({ where: { returnLocationId: id } }),
    prisma.materialLedgerEntry.count({ where: { fromLocationId: id } }),
    prisma.materialLedgerEntry.count({ where: { toLocationId: id } }),
  ]);
  if (items + children + receivingLines + releaseLines + returnLines + ledgerFrom + ledgerTo > 0) {
    throw new Error("Can't delete — this location is still referenced somewhere. Deactivate it instead.");
  }

  const location = await prisma.warehouseLocation.findUniqueOrThrow({ where: { id } });
  await prisma.warehouseLocation.delete({ where: { id } });

  await logAudit(session, {
    action: "DELETE_WAREHOUSE_LOCATION",
    entityType: "WarehouseLocation",
    entityId: id,
    summary: `Deleted unused warehouse location ${location.code}`,
  });

  revalidatePath("/warehouse");
}
