import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession, canManageCustomerOrders, isAdminRole } from "@/lib/auth";
import { getOrderMaterialChecks, getOrderQaStatus, getCustomerOrderAuditTrail, getBatchRecordsForLinking } from "@/lib/actions/customer-order-actions";
import { computeBatchQaStatus } from "@/lib/customer-order-defaults";
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
          batchRecords: {
            select: {
              id: true,
              batchNumber: true,
              productName: true,
              status: true,
              scheduledDate: true,
              estimatedHours: true,
              machine: { select: { name: true } },
              qcSamples: { select: { sampleType: true, status: true } },
            },
          },
        },
      },
    },
  });
  if (!order) notFound();

  const [materialChecks, qaStatus, auditTrail, batchRecordOptions, planners, products] = await Promise.all([
    getOrderMaterialChecks(id),
    getOrderQaStatus(id),
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
          batchRecords: l.batchRecords.map((b) => ({
            id: b.id,
            batchNumber: b.batchNumber,
            productName: b.productName,
            status: b.status,
            scheduledDate: b.scheduledDate?.toISOString() ?? null,
            estimatedHours: b.estimatedHours,
            machineName: b.machine?.name ?? null,
            qaStatus: computeBatchQaStatus(b.qcSamples),
          })),
          materialCheck: materialChecks[l.id] ?? { lineStatus: "NO_BOM" as const, materials: [] },
          qaStatus: qaStatus.lineStatuses[l.id] ?? "NOT_STARTED",
        })),
      }}
      orderQaStatus={qaStatus.orderStatus}
      auditTrail={auditTrail}
      batchRecordOptions={batchRecordOptions}
      planners={planners}
      products={products}
      canManage={!!session && canManageCustomerOrders(session.role)}
      isAdmin={!!session && isAdminRole(session.role)}
    />
  );
}
