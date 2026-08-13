import { prisma } from "@/lib/prisma";
import { getSession, canManagePurchasing } from "@/lib/auth";
import { listSuppliers, listPurchaseOrders } from "@/lib/actions/procurement-actions";
import ProcurementClient from "./procurement-client";

export default async function ProcurementPage() {
  const session = await getSession();

  const [suppliers, purchaseOrders, items] = await Promise.all([
    listSuppliers(),
    listPurchaseOrders(),
    prisma.warehouseItem.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, itemCode: true, name: true, unit: true } }),
  ]);

  return (
    <ProcurementClient
      suppliers={suppliers.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        contactName: s.contactName,
        contactEmail: s.contactEmail,
        contactPhone: s.contactPhone,
        leadTimeDays: s.leadTimeDays,
        notes: s.notes,
        active: s.active,
      }))}
      purchaseOrders={purchaseOrders.map((po) => ({
        id: po.id,
        poNumber: po.poNumber,
        supplierName: po.supplier.name,
        orderDate: po.orderDate.toISOString(),
        expectedDeliveryDate: po.expectedDeliveryDate.toISOString(),
        status: po.status,
        notes: po.notes,
        lines: po.lines.map((l) => ({ id: l.id, itemName: l.item.name, itemCode: l.item.itemCode, quantity: l.quantity, unit: l.unit, notes: l.notes })),
      }))}
      items={items}
      canManage={!!session && canManagePurchasing(session.role)}
    />
  );
}
