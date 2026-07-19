"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canManageWarehouse, canRequestMaterials } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getAvailableBalance } from "@/lib/warehouse-ledger";
import type { Priority, ReceiptOutcome, StockBucket } from "@/generated/prisma";

async function requireWarehouseManagerAccess() {
  const session = await getSession();
  if (!session || !canManageWarehouse(session.role)) throw new Error("Not authorized");
  return session;
}

async function requireRequesterAccess() {
  const session = await getSession();
  if (!session || !canRequestMaterials(session.role)) throw new Error("Not authorized");
  return session;
}

/** Tracks in-memory running AVAILABLE balances within one batch of ledger entries, so two lines
 * for the same item/lot in the same action get correct sequential resultingBalance values instead
 * of both reading the same not-yet-committed starting balance. */
class BalanceTracker {
  private cache = new Map<string, number>();

  private key(itemId: string, lotNumber: string | null) {
    return `${itemId}::${lotNumber ?? ""}`;
  }

  async apply(itemId: string, lotNumber: string | null, fromBucket: StockBucket | null, toBucket: StockBucket | null, quantity: number) {
    const key = this.key(itemId, lotNumber);
    if (!this.cache.has(key)) this.cache.set(key, await getAvailableBalance(itemId, lotNumber));
    let balance = this.cache.get(key)!;
    if (toBucket === "AVAILABLE") balance += quantity;
    if (fromBucket === "AVAILABLE") balance -= quantity;
    this.cache.set(key, balance);
    return balance;
  }
}

function nextRequestNumber(count: number) {
  return `MR-${String(count + 1).padStart(6, "0")}`;
}

export async function createMaterialRequest(data: {
  batchReference: string;
  batchSize: number | null;
  batchSizeUnit: string | null;
  requiredDate: string | null;
  priority: Priority;
  comments: string | null;
  lines: { itemId: string | null; ingredientNameFreeText: string | null; requestedQty: number; unit: string }[];
}) {
  const session = await requireRequesterAccess();
  if (!data.batchReference) throw new Error("Batch reference is required");
  if (data.lines.length === 0) throw new Error("At least one ingredient line is required");

  const count = await prisma.warehouseMaterialRequest.count();
  const requestNumber = nextRequestNumber(count);

  const request = await prisma.warehouseMaterialRequest.create({
    data: {
      requestNumber,
      batchReference: data.batchReference,
      batchSize: data.batchSize,
      batchSizeUnit: data.batchSizeUnit,
      requiredDate: data.requiredDate ? new Date(data.requiredDate) : null,
      priority: data.priority,
      requestedByName: session.fullName,
      comments: data.comments,
      lines: {
        create: data.lines.map((l) => ({
          itemId: l.itemId,
          ingredientNameFreeText: l.ingredientNameFreeText,
          requestedQty: l.requestedQty,
          unit: l.unit,
        })),
      },
    },
  });

  await logAudit(session, {
    action: "CREATE_MATERIAL_REQUEST",
    entityType: "WarehouseMaterialRequest",
    entityId: request.id,
    summary: `Created material request ${requestNumber} for batch ${data.batchReference} (${data.lines.length} ingredient${data.lines.length === 1 ? "" : "s"})`,
  });

  revalidatePath("/warehouse");
}

/** Formula Manager integration: builds a request straight from a Batch Record's own already-scaled
 * ingredient list (BatchMaterialRequestLine.kgPerBatch) — the same figures already printed on that
 * batch's PDF/signed off by QA — rather than re-deriving quantities from the formulation. */
export async function createWarehouseRequestFromBatchRecord(batchRecordId: string) {
  const session = await requireRequesterAccess();

  const batch = await prisma.batchRecord.findUnique({
    where: { id: batchRecordId },
    include: { materialRequests: { orderBy: { order: "asc" } } },
  });
  if (!batch) throw new Error("Batch record not found");

  const existing = await prisma.warehouseMaterialRequest.findFirst({ where: { batchReference: batch.batchNumber } });
  if (existing) {
    throw new Error(
      `A material request (${existing.requestNumber}) already exists for batch ${batch.batchNumber} — check the Production Requests tab in Warehouse Management.`
    );
  }

  const lines = batch.materialRequests
    .filter((m) => m.kgPerBatch && m.kgPerBatch > 0)
    .map((m) => ({ ingredientNameFreeText: m.ingredientName, requestedQty: m.kgPerBatch!, unit: "kg" }));
  if (lines.length === 0) {
    throw new Error("This batch record has no ingredient quantities to pull from yet — fill in the Material Request table first.");
  }

  const count = await prisma.warehouseMaterialRequest.count();
  const requestNumber = nextRequestNumber(count);

  const request = await prisma.warehouseMaterialRequest.create({
    data: {
      requestNumber,
      batchReference: batch.batchNumber,
      batchSize: batch.numberOfMixes * batch.batchSizePerMix,
      batchSizeUnit: batch.batchSizeUnit,
      priority: "MEDIUM",
      requestedByName: session.fullName,
      formulationId: batch.formulationId,
      comments: `Auto-created from Batch Record ${batch.batchNumber}`,
      lines: { create: lines },
    },
  });

  await logAudit(session, {
    action: "CREATE_MATERIAL_REQUEST_FROM_BATCH_RECORD",
    entityType: "WarehouseMaterialRequest",
    entityId: request.id,
    summary: `Auto-created material request ${requestNumber} from Batch Record ${batch.batchNumber} (${lines.length} ingredient${lines.length === 1 ? "" : "s"})`,
  });

  revalidatePath("/warehouse");
  revalidatePath(`/batch-records/${batchRecordId}`);

  return requestNumber;
}

/** Step 2 — Warehouse Material Release. No stock deduction: writes a RESERVE entry per line (AVAILABLE -> RESERVED).
 * A line created with only a free-text ingredient name (e.g. auto-imported from a Batch Record) has no
 * WarehouseItem yet -- linkItemId lets the warehouse operator link one at release time instead of being
 * stuck with no way to ever release that line. */
export async function releaseRequestToProduction(
  requestId: string,
  lines: {
    lineId: string;
    linkItemId?: string | null;
    releasedQty: number;
    releaseLotNumber: string | null;
    releaseExpiry: string | null;
    releaseLocationId: string | null;
    releaseComments: string | null;
  }[]
) {
  const session = await requireWarehouseManagerAccess();
  if (lines.length === 0) throw new Error("Nothing to release");

  const requestLines = await prisma.warehouseRequestLine.findMany({ where: { requestId } });
  const lineById = new Map(requestLines.map((l) => [l.id, l]));

  const tracker = new BalanceTracker();
  const now = new Date();
  const ops = [];

  for (const line of lines) {
    const requestLine = lineById.get(line.lineId);
    if (!requestLine) throw new Error("Request line not found");
    const itemId = requestLine.itemId ?? line.linkItemId ?? null;
    if (!itemId) throw new Error(`Line for "${requestLine.ingredientNameFreeText ?? "ingredient"}" has no linked warehouse item — link an item before releasing`);

    ops.push(
      prisma.warehouseRequestLine.update({
        where: { id: line.lineId },
        data: {
          itemId,
          releasedQty: line.releasedQty,
          releaseLotNumber: line.releaseLotNumber,
          releaseExpiry: line.releaseExpiry ? new Date(line.releaseExpiry) : null,
          releaseLocationId: line.releaseLocationId,
          releaseComments: line.releaseComments,
          releasedByName: session.fullName,
          releasedAt: now,
        },
      })
    );

    const resultingBalance = await tracker.apply(itemId, line.releaseLotNumber, "AVAILABLE", "RESERVED", line.releasedQty);
    ops.push(
      prisma.materialLedgerEntry.create({
        data: {
          entryType: "RESERVE",
          itemId,
          lotNumber: line.releaseLotNumber,
          quantity: line.releasedQty,
          unit: requestLine.unit,
          fromBucket: "AVAILABLE",
          toBucket: "RESERVED",
          toLocationId: line.releaseLocationId,
          requestId,
          requestLineId: line.lineId,
          performedByName: session.fullName,
          resultingBalance,
        },
      })
    );
  }

  ops.push(
    prisma.warehouseMaterialRequest.update({
      where: { id: requestId },
      data: { status: "WAITING_PRODUCTION_CONFIRMATION" },
    })
  );

  await prisma.$transaction(ops);

  await logAudit(session, {
    action: "RELEASE_MATERIAL_REQUEST",
    entityType: "WarehouseMaterialRequest",
    entityId: requestId,
    summary: `Released ${lines.length} line${lines.length === 1 ? "" : "s"} to production for request`,
  });

  revalidatePath("/warehouse");
}

/** Step 3 — Production Material Receiving: per-line accept/reject/shortage/damage check. No ledger write yet. */
export async function recordLineReceiptCheck(lineId: string, outcome: ReceiptOutcome, receivedQty: number) {
  const session = await requireRequesterAccess();

  const line = await prisma.warehouseRequestLine.update({
    where: { id: lineId },
    data: { receiptOutcome: outcome, receivedQty, receivedByName: session.fullName, receivedAt: new Date() },
  });

  if (outcome !== "ACCEPTED") {
    await prisma.warehouseMaterialRequest.updateMany({
      where: { id: line.requestId, status: { in: ["RELEASED", "WAITING_PRODUCTION_CONFIRMATION"] } },
      data: { status: "PARTIALLY_RECEIVED" },
    });
  }

  await logAudit(session, {
    action: "RECORD_MATERIAL_RECEIPT_CHECK",
    entityType: "WarehouseRequestLine",
    entityId: lineId,
    summary: `Recorded receipt check: ${outcome} (${receivedQty} received)`,
  });

  revalidatePath("/warehouse");
}

/** Step 4 — Production confirms all materials received. The ONLY stock-deducting action: writes an ISSUE entry (RESERVED -> IN_PRODUCTION) per accepted/shortage line. */
export async function confirmMaterialsReceived(requestId: string) {
  const session = await requireRequesterAccess();

  const lines = await prisma.warehouseRequestLine.findMany({ where: { requestId } });
  if (lines.some((l) => !l.receiptOutcome)) {
    throw new Error("Every line must be checked (accept/reject/shortage/damage) before confirming");
  }

  const tracker = new BalanceTracker();
  const ops = [];

  for (const line of lines) {
    if (!line.itemId) continue;
    if (line.receiptOutcome !== "ACCEPTED" && line.receiptOutcome !== "SHORTAGE") continue;
    const qty = line.receivedQty ?? 0;
    if (qty <= 0) continue;

    // RESERVED -> IN_PRODUCTION doesn't touch AVAILABLE (already deducted at release/RESERVE time), so resultingBalance is unchanged here.
    const resultingBalance = await tracker.apply(line.itemId, line.releaseLotNumber, "RESERVED", "IN_PRODUCTION", qty);
    ops.push(
      prisma.materialLedgerEntry.create({
        data: {
          entryType: "ISSUE",
          itemId: line.itemId,
          lotNumber: line.releaseLotNumber,
          quantity: qty,
          unit: line.unit,
          fromBucket: "RESERVED",
          toBucket: "IN_PRODUCTION",
          requestId,
          requestLineId: line.id,
          performedByName: session.fullName,
          resultingBalance,
        },
      })
    );
  }

  const anyIssue = lines.some((l) => l.receiptOutcome === "REJECTED" || l.receiptOutcome === "DAMAGED");
  ops.push(
    prisma.warehouseMaterialRequest.update({
      where: { id: requestId },
      data: { status: anyIssue ? "PARTIALLY_RECEIVED" : "IN_PRODUCTION" },
    })
  );

  await prisma.$transaction(ops);

  await logAudit(session, {
    action: "CONFIRM_MATERIALS_RECEIVED",
    entityType: "WarehouseMaterialRequest",
    entityId: requestId,
    summary: `Confirmed materials received — stock deducted for ${lines.filter((l) => l.receiptOutcome === "ACCEPTED" || l.receiptOutcome === "SHORTAGE").length} line(s)`,
  });

  revalidatePath("/warehouse");
}

/** Step 5 — incremental usage tracking during production. Informational only, no ledger entry. */
export async function updateLineUsage(lineId: string, usedQty: number | null, wasteQty: number | null) {
  const session = await requireRequesterAccess();

  await prisma.warehouseRequestLine.update({ where: { id: lineId }, data: { usedQty, wasteQty } });

  await logAudit(session, {
    action: "UPDATE_MATERIAL_USAGE",
    entityType: "WarehouseRequestLine",
    entityId: lineId,
    summary: `Updated usage: used ${usedQty ?? 0}, waste ${wasteQty ?? 0}`,
  });

  revalidatePath("/warehouse");
}

/** Step 6 — Production sends remaining materials back to the warehouse. No stock increase yet: writes a STATUS_CHANGE entry (IN_PRODUCTION -> AWAITING_VERIFICATION). */
export async function sendReturnToWarehouse(requestId: string, lines: { lineId: string; returnQty: number }[]) {
  const session = await requireRequesterAccess();
  if (lines.length === 0) throw new Error("Nothing to return");

  const requestLines = await prisma.warehouseRequestLine.findMany({ where: { requestId } });
  const lineById = new Map(requestLines.map((l) => [l.id, l]));

  const now = new Date();
  const ops = [];

  for (const line of lines) {
    if (line.returnQty <= 0) continue;
    const requestLine = lineById.get(line.lineId);
    if (!requestLine || !requestLine.itemId) continue;

    ops.push(
      prisma.warehouseRequestLine.update({
        where: { id: line.lineId },
        data: { returnQty: line.returnQty, returnSubmittedByName: session.fullName, returnSubmittedAt: now },
      })
    );

    ops.push(
      prisma.materialLedgerEntry.create({
        data: {
          entryType: "STATUS_CHANGE",
          itemId: requestLine.itemId,
          lotNumber: requestLine.releaseLotNumber,
          quantity: line.returnQty,
          unit: requestLine.unit,
          fromBucket: "IN_PRODUCTION",
          toBucket: "AWAITING_VERIFICATION",
          requestId,
          requestLineId: line.lineId,
          performedByName: session.fullName,
          resultingBalance: await getAvailableBalance(requestLine.itemId, requestLine.releaseLotNumber),
        },
      })
    );
  }

  ops.push(prisma.warehouseMaterialRequest.update({ where: { id: requestId }, data: { status: "RETURN_PENDING" } }));

  await prisma.$transaction(ops);

  await logAudit(session, {
    action: "SEND_MATERIAL_RETURN",
    entityType: "WarehouseMaterialRequest",
    entityId: requestId,
    summary: `Sent ${lines.length} line${lines.length === 1 ? "" : "s"} back to warehouse for verification`,
  });

  revalidatePath("/warehouse");
}

/** Steps 7/8 — Warehouse verifies condition, assigns storage, confirms. The ONLY stock-increasing action: writes a RETURN entry (AWAITING_VERIFICATION -> AVAILABLE). */
export async function confirmReturn(
  requestId: string,
  lines: { lineId: string; returnConditionNotes: string | null; returnLocationId: string | null }[]
) {
  const session = await requireWarehouseManagerAccess();

  const requestLines = await prisma.warehouseRequestLine.findMany({ where: { requestId } });
  const lineById = new Map(requestLines.map((l) => [l.id, l]));

  const tracker = new BalanceTracker();
  const now = new Date();
  const ops = [];

  for (const line of lines) {
    const requestLine = lineById.get(line.lineId);
    if (!requestLine || !requestLine.itemId || !requestLine.returnQty) continue;

    ops.push(
      prisma.warehouseRequestLine.update({
        where: { id: line.lineId },
        data: {
          returnConditionNotes: line.returnConditionNotes,
          returnLocationId: line.returnLocationId,
          returnVerifiedByName: session.fullName,
          returnVerifiedAt: now,
        },
      })
    );

    const resultingBalance = await tracker.apply(requestLine.itemId, requestLine.releaseLotNumber, "AWAITING_VERIFICATION", "AVAILABLE", requestLine.returnQty);
    ops.push(
      prisma.materialLedgerEntry.create({
        data: {
          entryType: "RETURN",
          itemId: requestLine.itemId,
          lotNumber: requestLine.releaseLotNumber,
          quantity: requestLine.returnQty,
          unit: requestLine.unit,
          fromBucket: "AWAITING_VERIFICATION",
          toBucket: "AVAILABLE",
          toLocationId: line.returnLocationId,
          requestId,
          requestLineId: line.lineId,
          performedByName: session.fullName,
          resultingBalance,
        },
      })
    );
  }

  ops.push(prisma.warehouseMaterialRequest.update({ where: { id: requestId }, data: { status: "COMPLETED" } }));

  await prisma.$transaction(ops);

  await logAudit(session, {
    action: "CONFIRM_MATERIAL_RETURN",
    entityType: "WarehouseMaterialRequest",
    entityId: requestId,
    summary: `Confirmed return — stock restored for ${lines.length} line(s), request completed`,
  });

  revalidatePath("/warehouse");
}
