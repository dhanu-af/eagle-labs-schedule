import { prisma } from "@/lib/prisma";
import { getSession, canManageCustomerOrders } from "@/lib/auth";
import { getActiveOrdersWithRisk } from "@/lib/actions/customer-order-actions";
import CustomerOrdersClient from "./customer-orders-client";

export default async function CustomerOrdersPage() {
  const session = await getSession();

  const [orders, customers, products, formulations, planners, riskOverview] = await Promise.all([
    prisma.customerOrder.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true, code: true } },
        lines: { include: { product: { select: { name: true, sku: true } } }, orderBy: { lineNumber: "asc" } },
      },
    }),
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({
      orderBy: { name: "asc" },
      include: { formulation: { select: { id: true, productName: true, baseBatchSize: true, baseUnit: true } } },
    }),
    prisma.formulation.findMany({
      select: { id: true, productName: true, baseBatchSize: true, baseUnit: true },
      orderBy: { productName: "asc" },
    }),
    prisma.user.findMany({ where: { disabled: false }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
    getActiveOrdersWithRisk(),
  ]);

  return (
    <CustomerOrdersClient
      orders={orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customer.name,
        customerCode: o.customer.code,
        customerPoNumber: o.customerPoNumber,
        customerRequestNumber: o.customerRequestNumber,
        orderDate: o.orderDate.toISOString(),
        requestedDeliveryDate: o.requestedDeliveryDate.toISOString(),
        confirmedDeliveryDate: o.confirmedDeliveryDate?.toISOString() ?? null,
        priority: o.priority,
        status: o.status,
        shippingRequirements: o.shippingRequirements,
        specialRequirements: o.specialRequirements,
        notes: o.notes,
        lines: o.lines.map((l) => ({
          id: l.id,
          lineNumber: l.lineNumber,
          productId: l.productId,
          productName: l.product.name,
          productSku: l.product.sku,
          quantity: l.quantity,
          unit: l.unit,
          packagingRequirement: l.packagingRequirement,
          artworkStatus: l.artworkStatus,
          notes: l.notes,
        })),
      }))}
      customers={customers.map((c) => ({ id: c.id, code: c.code, name: c.name, contactName: c.contactName, contactEmail: c.contactEmail, contactPhone: c.contactPhone, address: c.address, notes: c.notes, active: c.active }))}
      products={products.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        defaultUnit: p.defaultUnit,
        formulationId: p.formulationId,
        formulationName: p.formulation?.productName ?? null,
        active: p.active,
      }))}
      formulations={formulations}
      planners={planners}
      riskOverview={riskOverview}
      canManage={!!session && canManageCustomerOrders(session.role)}
    />
  );
}
