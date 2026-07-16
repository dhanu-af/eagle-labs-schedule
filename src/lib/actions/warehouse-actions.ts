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
