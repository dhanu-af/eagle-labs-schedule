import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession, canManageCustomerOrders } from "@/lib/auth";
import { getOrderMaterialChecks, getCustomerOrderAuditTrail, getBatchRecordsForLinking } from "@/lib/actions/customer-order-actions";
import OrderDetailClient from "./order-detail-client";

export default async function CustomerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  const order = await prisma.customerOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      responsiblePlanner: { select: { id: true, fullName: true } },
      salesOwner: { select: { id: true, fullName: true } },
      lines: {
        orderBy: { lineNumber: "asc" },
        include: {
          product: { select: { id: true, name: true, sku: true, formulationId: true } },
          batchRecords: { select: { id: true, batchNumber: true, productName: true, status: true } },
        },
      },
    },
  });
  if (!order) notFound();

  const [materialChecks, auditTrail, batchRecordOptions, planners, products] = await Promise.all([
    getOrderMaterialChecks(id),
    getCustomerOrderAuditTrail(id),
    getBatchRecordsForLinking(),
    prisma.user.findMany({ where: { disabled: false }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, sku: true, name: true, defaultUnit: true } }),
  ]);

  return (
    <OrderDetailClient
      order={{
        id: order.id,
        orderNumber: order.orderNumber,
        customer: { id: order.customer.id, name: order.customer.name, code: order.customer.code },
        customerPoNumber: order.customerPoNumber,
        customerRequestNumber: order.customerRequestNumber,
        orderDate: order.orderDate.toISOString(),
        requestedDeliveryDate: order.requestedDeliveryDate.toISOString(),
        confirmedDeliveryDate: order.confirmedDeliveryDate?.toISOString() ?? null,
        priority: order.priority,
        status: order.status,
        responsiblePlannerId: order.responsiblePlannerId,
        salesOwnerId: order.salesOwnerId,
        shippingRequirements: order.shippingRequirements,
        specialRequirements: order.specialRequirements,
        notes: order.notes,
        lines: order.lines.map((l) => ({
          id: l.id,
          lineNumber: l.lineNumber,
          productId: l.productId,
          productName: l.product.name,
          productSku: l.product.sku,
          hasBom: !!l.product.formulationId,
          quantity: l.quantity,
          unit: l.unit,
          packagingRequirement: l.packagingRequirement,
          artworkStatus: l.artworkStatus,
          notes: l.notes,
          batchRecords: l.batchRecords,
          materialCheck: materialChecks[l.id] ?? { lineStatus: "NO_BOM" as const, materials: [] },
        })),
      }}
      auditTrail={auditTrail}
      batchRecordOptions={batchRecordOptions}
      planners={planners}
      products={products}
      canManage={!!session && canManageCustomerOrders(session.role)}
    />
  );
}
