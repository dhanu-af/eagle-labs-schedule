"use server";

import { prisma } from "@/lib/prisma";
import { getSession, canManageRole } from "@/lib/auth";
import { notifyManagers } from "@/lib/notify";
import { getActiveOrdersWithRisk } from "@/lib/actions/customer-order-actions";
import { getCapacityOverview } from "@/lib/actions/capacity-planning-actions";
import { toDateKey } from "@/lib/capacity-planning-defaults";
import { listMaterialShortages } from "@/lib/actions/material-shortage-actions";

const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

type AlertCandidate = { type: string; link: string; title: string; message: string };

/** Skips a candidate if the same type+link already fired within the dedup window --
 * throttles to at most one alert per real issue per day, while a persistent problem
 * still resurfaces daily rather than being silenced forever after the first alert. */
async function alreadyAlerted(type: string, link: string): Promise<boolean> {
  const recent = await prisma.notification.findFirst({
    where: { type, link, createdAt: { gte: new Date(Date.now() - DEDUP_WINDOW_MS) } },
    select: { id: true },
  });
  return !!recent;
}

/** Reuses the exact same risk computation the Control Tower displays -- an alert can
 * never say something the dashboard itself wouldn't show. No new schema: pushes into the
 * existing Notification model via the existing notifyManagers() helper, so alerts land in
 * the header's real notification bell for every manager-tier employee, not just whoever
 * happens to be looking at the Control Tower right now. */
export async function syncAlerts(): Promise<{ created: number; skipped: number }> {
  const session = await getSession();
  if (!session || !canManageRole(session.role)) throw new Error("Not authorized");

  const [activeOrders, capacityToday, materialShortages, recentQcFailures, latePos] = await Promise.all([
    getActiveOrdersWithRisk(),
    getCapacityOverview(new Date(), 1),
    listMaterialShortages(),
    prisma.qcSample.findMany({
      where: { status: "REJECTED", updatedAt: { gte: new Date(Date.now() - DEDUP_WINDOW_MS) } },
      select: { sampleId: true, productName: true, batchNumber: true },
    }),
    prisma.purchaseOrder.findMany({
      where: { status: { notIn: ["DRAFT", "RECEIVED", "CANCELLED"] }, expectedDeliveryDate: { lt: new Date() } },
      select: { poNumber: true, expectedDeliveryDate: true, supplier: { select: { name: true } } },
    }),
  ]);

  const candidates: AlertCandidate[] = [];

  for (const order of activeOrders) {
    const link = `/customer-orders/${order.id}`;
    if (order.risk.overdue) {
      candidates.push({
        type: "ORDER_OVERDUE",
        link,
        title: `Order ${order.orderNumber} is overdue`,
        message: `${order.customerName} — ${order.risk.reasons.join("; ")}`,
      });
    } else if (order.risk.atRisk) {
      candidates.push({
        type: "ORDER_AT_RISK",
        link,
        title: `Order ${order.orderNumber} is at risk of missing its delivery date`,
        message: `${order.customerName} — ${order.risk.reasons.join("; ")}`,
      });
    }
    if (order.qaStatus === "HELD") {
      candidates.push({
        type: "ORDER_QA_HOLD",
        link,
        title: `Order ${order.orderNumber} has a QA hold`,
        message: `${order.customerName} — a linked batch failed QC and needs review before this order can dispatch.`,
      });
    }
  }

  const todayKey = toDateKey(new Date());
  for (const row of capacityToday.rows) {
    const cell = row.cells[todayKey];
    if (cell?.overload) {
      candidates.push({
        type: "CAPACITY_OVERLOAD",
        link: "/capacity-planning",
        title: `${row.name} is overloaded today`,
        message: `Scheduled ${cell.scheduledHours}h against ${cell.availableHours}h available (${cell.remainingHours}h over).`,
      });
    }
  }

  // Only RED (needed within 7 days, see computeShortageRiskLevel) rises to an
  // alert — AMBER/GREEN shortages still have runway and would otherwise page
  // managers for every short item on the register, most of which resolve
  // themselves before it matters. Mirrors the overdue-vs-at-risk split above.
  for (const row of materialShortages) {
    if (row.riskLevel !== "RED") continue;
    candidates.push({
      type: "MATERIAL_SHORTAGE",
      link: `/material-shortages?item=${row.warehouseItemId}`,
      title: `${row.itemName} (${row.itemCode}) is short and needed within 7 days`,
      message: `Short ${row.netShortageKg}${row.unit} — affects ${row.affectedOrders.map((o) => o.orderNumber).join(", ")}.`,
    });
  }

  // Rejections are a permanent historical status (no un-reject flow), so
  // without the updatedAt window above this would re-alert on every rejected
  // sample forever, not just newly-rejected ones.
  for (const sample of recentQcFailures) {
    candidates.push({
      type: "QC_FAILURE",
      link: `/qc-samples?sample=${sample.sampleId}`,
      title: `QC sample ${sample.sampleId} was rejected`,
      message: `${sample.productName} — batch ${sample.batchNumber} failed QC and needs review.`,
    });
  }

  // Deliberately no time-window here, unlike QC failures above — "late" is a
  // live, ongoing condition (like order overdue) that should keep resurfacing
  // daily via the existing dedup window until the PO is actually received.
  for (const po of latePos) {
    const daysLate = Math.floor((Date.now() - po.expectedDeliveryDate.getTime()) / (1000 * 60 * 60 * 24));
    candidates.push({
      type: "PO_LATE",
      link: `/procurement?po=${po.poNumber}`,
      title: `PO ${po.poNumber} is ${daysLate} day${daysLate === 1 ? "" : "s"} late`,
      message: `${po.supplier.name} — expected ${po.expectedDeliveryDate.toLocaleDateString("en-AU")}, still not fully received.`,
    });
  }

  let created = 0;
  let skipped = 0;
  for (const candidate of candidates) {
    if (await alreadyAlerted(candidate.type, candidate.link)) {
      skipped += 1;
      continue;
    }
    await notifyManagers(candidate);
    created += 1;
  }

  return { created, skipped };
}
