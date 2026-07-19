"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canManageWarehouse, canQaReleaseStock } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { computeResultingBalance } from "@/lib/warehouse-ledger";

async function requireWarehouseManagerAccess() {
  const session = await getSession();
  if (!session || !canManageWarehouse(session.role)) throw new Error("Not authorized");
  return session;
}

async function requireQaAccess() {
  const session = await getSession();
  if (!session || !canQaReleaseStock(session.role)) throw new Error("Not authorized");
  return session;
}

type NewGoodsReceivingLine = {
  itemId: string;
  lotNumber: string;
  supplierLot: string | null;
  internalLot: string | null;
  expiryDate: string | null;
  manufactureDate: string | null;
  quantity: number;
  unit: string;
  coaReference: string | null;
  photoReference: string | null;
  deliveryDocketReference: string | null;
  storageCondition: string | null;
};

export async function createGoodsReceiving(header: {
  supplierName: string;
  poNumber: string | null;
  deliveryDate: string;
  invoiceRef: string | null;
  checkedByName: string | null;
  approvedByName: string | null;
}, lines: NewGoodsReceivingLine[]) {
  const session = await requireWarehouseManagerAccess();
  if (!header.supplierName || !header.deliveryDate) throw new Error("Supplier and delivery date are required");
  if (lines.length === 0) throw new Error("At least one line item is required");

  const receiving = await prisma.goodsReceiving.create({
    data: {
      supplierName: header.supplierName,
      poNumber: header.poNumber,
      deliveryDate: new Date(header.deliveryDate),
      invoiceRef: header.invoiceRef,
      receivedByName: session.fullName,
      checkedByName: header.checkedByName,
      approvedByName: header.approvedByName,
      lines: {
        create: lines.map((l) => ({
          itemId: l.itemId,
          lotNumber: l.lotNumber,
          supplierLot: l.supplierLot,
          internalLot: l.internalLot,
          expiryDate: l.expiryDate ? new Date(l.expiryDate) : null,
          manufactureDate: l.manufactureDate ? new Date(l.manufactureDate) : null,
          quantity: l.quantity,
          unit: l.unit,
          coaReference: l.coaReference,
          photoReference: l.photoReference,
          deliveryDocketReference: l.deliveryDocketReference,
          storageCondition: l.storageCondition,
        })),
      },
    },
  });

  await logAudit(session, {
    action: "CREATE_GOODS_RECEIVING",
    entityType: "GoodsReceiving",
    entityId: receiving.id,
    summary: `Logged goods receiving from ${header.supplierName} (${lines.length} line${lines.length === 1 ? "" : "s"}) — entered Quarantine pending QA release`,
  });

  revalidatePath("/warehouse");
}

/** QA release: the ONLY point a freshly received line becomes real stock — writes the first RECEIPT ledger entry for that lot. */
export async function qaReleaseGoodsReceivingLine(lineId: string, locationId: string) {
  const session = await requireQaAccess();

  const line = await prisma.goodsReceivingLine.findUniqueOrThrow({ where: { id: lineId } });
  if (line.status !== "QUARANTINE") throw new Error("Only lines still in Quarantine can be QA released");

  const resultingBalance = await computeResultingBalance(line.itemId, line.lotNumber, null, "AVAILABLE", line.quantity);

  await prisma.$transaction([
    prisma.goodsReceivingLine.update({
      where: { id: lineId },
      data: {
        status: "RELEASED",
        locationId,
        qaReleasedByName: session.fullName,
        qaReleasedAt: new Date(),
      },
    }),
    prisma.materialLedgerEntry.create({
      data: {
        entryType: "RECEIPT",
        itemId: line.itemId,
        lotNumber: line.lotNumber,
        quantity: line.quantity,
        unit: line.unit,
        toBucket: "AVAILABLE",
        toLocationId: locationId,
        goodsReceivingLineId: line.id,
        performedByName: session.fullName,
        resultingBalance,
      },
    }),
  ]);

  await logAudit(session, {
    action: "QA_RELEASE_GOODS_RECEIVING_LINE",
    entityType: "GoodsReceivingLine",
    entityId: lineId,
    summary: `QA released lot ${line.lotNumber} (${line.quantity} ${line.unit}) into Available stock`,
  });

  revalidatePath("/warehouse");
}

/** Only safe to delete while nothing has been QA released -- a RELEASED line has a RECEIPT ledger
 * entry referencing it, and the ledger is append-only, so deleting it would corrupt the audit trail. */
export async function deleteGoodsReceiving(id: string) {
  const session = await requireWarehouseManagerAccess();

  const receiving = await prisma.goodsReceiving.findUniqueOrThrow({ where: { id }, include: { lines: true } });
  if (receiving.lines.some((l) => l.status === "RELEASED")) {
    throw new Error("Can't delete — at least one line has already been QA released into stock.");
  }

  await prisma.goodsReceiving.delete({ where: { id } });

  await logAudit(session, {
    action: "DELETE_GOODS_RECEIVING",
    entityType: "GoodsReceiving",
    entityId: id,
    summary: `Deleted goods receiving from ${receiving.supplierName} (never QA released)`,
  });

  revalidatePath("/warehouse");
}

export async function rejectGoodsReceivingLine(lineId: string, reason: string) {
  const session = await requireQaAccess();
  if (!reason) throw new Error("A rejection reason is required");

  const line = await prisma.goodsReceivingLine.findUniqueOrThrow({ where: { id: lineId } });
  if (line.status !== "QUARANTINE") throw new Error("Only lines still in Quarantine can be rejected");

  await prisma.goodsReceivingLine.update({
    where: { id: lineId },
    data: { status: "REJECTED", qaRejectReason: reason, qaReleasedByName: session.fullName, qaReleasedAt: new Date() },
  });

  await logAudit(session, {
    action: "REJECT_GOODS_RECEIVING_LINE",
    entityType: "GoodsReceivingLine",
    entityId: lineId,
    summary: `Rejected lot ${line.lotNumber}: ${reason}`,
  });

  revalidatePath("/warehouse");
}
