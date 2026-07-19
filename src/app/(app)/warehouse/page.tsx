import { prisma } from "@/lib/prisma";
import { getSession, canManageWarehouse, canRequestMaterials, canQaReleaseStock, canEdit } from "@/lib/auth";
import { getItemStockSummary } from "@/lib/warehouse-ledger";
import WarehouseClient from "./warehouse-client";

export default async function WarehousePage() {
  const session = await getSession();

  const [items, locations, receivings, requests] = await Promise.all([
    prisma.warehouseItem.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.warehouseLocation.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    prisma.goodsReceiving.findMany({
      orderBy: { createdAt: "desc" },
      include: { lines: { include: { item: true }, orderBy: { createdAt: "asc" } } },
    }),
    prisma.warehouseMaterialRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: { lines: { include: { item: true }, orderBy: { createdAt: "asc" } } },
    }),
  ]);

  const stockSummaries = await Promise.all(
    items.map(async (item) => ({ itemId: item.id, summary: await getItemStockSummary(item.id) }))
  );

  return (
    <WarehouseClient
      items={items.map((i) => ({
        id: i.id,
        itemCode: i.itemCode,
        name: i.name,
        category: i.category,
        subCategory: i.subCategory,
        ingredientId: i.ingredientId,
        unit: i.unit,
        minimumStock: i.minimumStock,
        maximumStock: i.maximumStock,
        defaultLocationId: i.defaultLocationId,
        stock: stockSummaries.find((s) => s.itemId === i.id)?.summary ?? null,
      }))}
      locations={locations.map((l) => ({
        id: l.id,
        code: l.code,
        label: l.label,
        zone: l.zone,
        parentId: l.parentId,
      }))}
      receivings={receivings.map((r) => ({
        id: r.id,
        supplierName: r.supplierName,
        poNumber: r.poNumber,
        deliveryDate: r.deliveryDate.toISOString(),
        invoiceRef: r.invoiceRef,
        receivedByName: r.receivedByName,
        checkedByName: r.checkedByName,
        approvedByName: r.approvedByName,
        createdAt: r.createdAt.toISOString(),
        lines: r.lines.map((l) => ({
          id: l.id,
          itemId: l.itemId,
          itemName: l.item.name,
          lotNumber: l.lotNumber,
          supplierLot: l.supplierLot,
          internalLot: l.internalLot,
          expiryDate: l.expiryDate?.toISOString() ?? null,
          manufactureDate: l.manufactureDate?.toISOString() ?? null,
          quantity: l.quantity,
          unit: l.unit,
          coaReference: l.coaReference,
          photoReference: l.photoReference,
          deliveryDocketReference: l.deliveryDocketReference,
          storageCondition: l.storageCondition,
          status: l.status,
          locationId: l.locationId,
          qaReleasedByName: l.qaReleasedByName,
          qaReleasedAt: l.qaReleasedAt?.toISOString() ?? null,
          qaRejectReason: l.qaRejectReason,
        })),
      }))}
      requests={requests.map((r) => ({
        id: r.id,
        requestNumber: r.requestNumber,
        batchReference: r.batchReference,
        batchSize: r.batchSize,
        batchSizeUnit: r.batchSizeUnit,
        requiredDate: r.requiredDate?.toISOString() ?? null,
        priority: r.priority,
        status: r.status,
        requestedByName: r.requestedByName,
        comments: r.comments,
        createdAt: r.createdAt.toISOString(),
        lines: r.lines.map((l) => ({
          id: l.id,
          itemId: l.itemId,
          itemName: l.item?.name ?? null,
          ingredientNameFreeText: l.ingredientNameFreeText,
          requestedQty: l.requestedQty,
          unit: l.unit,
          releasedQty: l.releasedQty,
          releaseLotNumber: l.releaseLotNumber,
          releaseExpiry: l.releaseExpiry?.toISOString() ?? null,
          releaseLocationId: l.releaseLocationId,
          releasedByName: l.releasedByName,
          releasedAt: l.releasedAt?.toISOString() ?? null,
          releaseComments: l.releaseComments,
          receiptOutcome: l.receiptOutcome,
          receivedQty: l.receivedQty,
          receivedByName: l.receivedByName,
          receivedAt: l.receivedAt?.toISOString() ?? null,
          usedQty: l.usedQty,
          wasteQty: l.wasteQty,
          returnQty: l.returnQty,
          returnConditionNotes: l.returnConditionNotes,
          returnLocationId: l.returnLocationId,
          returnSubmittedByName: l.returnSubmittedByName,
          returnSubmittedAt: l.returnSubmittedAt?.toISOString() ?? null,
          returnVerifiedByName: l.returnVerifiedByName,
          returnVerifiedAt: l.returnVerifiedAt?.toISOString() ?? null,
        })),
      }))}
      canManage={!!session && canManageWarehouse(session.role)}
      canRequest={!!session && canRequestMaterials(session.role)}
      canQaRelease={!!session && canQaReleaseStock(session.role)}
      isSuperAdmin={!!session && canEdit(session.role)}
    />
  );
}
