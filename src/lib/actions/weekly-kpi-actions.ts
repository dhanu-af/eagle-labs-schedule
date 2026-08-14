"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canManageWeeklyKpi } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { computeYieldPct } from "@/lib/mfg-reconciliation-defaults";
import { getActiveOrdersWithRisk, getOrderMaterialChecks } from "@/lib/actions/customer-order-actions";
import { listMaterialShortages } from "@/lib/actions/material-shortage-actions";
import { weekBounds, roundPct } from "@/lib/weekly-kpi-defaults";
import type { EscalationLevel } from "@/generated/prisma";

const BASE_PATH = "/weekly-kpi";

async function requireAccess() {
  const session = await getSession();
  if (!session || !canManageWeeklyKpi(session.role)) throw new Error("Not authorized");
  return session;
}

export async function listWeeklyKpiScorecards() {
  return prisma.weeklyKpiScorecard.findMany({ orderBy: { weekEnding: "desc" } });
}

export type WeeklyKpiSuggestions = {
  otifPct: number | null;
  pastDueOrders: number | null;
  materialAvailabilityPct: number | null;
  criticalShortages: number | null;
  productionAttainmentPct: number | null;
  averageYieldPct: number | null;
};

/**
 * Suggested starting values for a week's scorecard, pulled from real live data --
 * never persisted by this function, just a pre-fill the reviewer can accept or
 * override before saving. Four of the ten fields (scheduleAdherencePct,
 * qcOnTimeReleasePct, inventoryAccuracyPct, unplannedScheduleChanges) have no
 * automated source anywhere in the app yet, so they're intentionally left out here
 * and stay manual-entry-only in the UI.
 */
export async function computeWeeklyKpiSuggestions(weekEndingIso: string): Promise<WeeklyKpiSuggestions> {
  await requireAccess();
  const weekEnding = new Date(weekEndingIso);
  const { start, end } = weekBounds(weekEnding);

  // OTIF % -- of orders due this week that have since reached a terminal
  // (DISPATCHED/DELIVERED/CLOSED) status, what fraction got there by their due date.
  // Still-open orders due this week are excluded from the denominator: their
  // outcome isn't known yet, so counting them either way would misrepresent OTIF.
  const dueThisWeek = await prisma.customerOrder.findMany({
    where: {
      OR: [
        { confirmedDeliveryDate: { gte: start, lt: end } },
        { AND: [{ confirmedDeliveryDate: null }, { requestedDeliveryDate: { gte: start, lt: end } }] },
      ],
    },
    select: { id: true, requestedDeliveryDate: true, confirmedDeliveryDate: true, status: true },
  });
  const completedIds = dueThisWeek.filter((o) => o.status === "DISPATCHED" || o.status === "DELIVERED" || o.status === "CLOSED").map((o) => o.id);

  let otifPct: number | null = null;
  if (completedIds.length > 0) {
    const completionLogs = await prisma.auditLog.findMany({
      where: {
        entityType: "CustomerOrder",
        entityId: { in: completedIds },
        action: "UPDATE_CUSTOMER_ORDER_STATUS",
        OR: [{ summary: { contains: "to DISPATCHED" } }, { summary: { contains: "to DELIVERED" } }, { summary: { contains: "to CLOSED" } }],
      },
      orderBy: { createdAt: "asc" },
      select: { entityId: true, createdAt: true },
    });
    const firstCompletionByOrder = new Map<string, Date>();
    for (const log of completionLogs) {
      if (log.entityId && !firstCompletionByOrder.has(log.entityId)) firstCompletionByOrder.set(log.entityId, log.createdAt);
    }

    let onTime = 0;
    let counted = 0;
    for (const order of dueThisWeek) {
      if (!completedIds.includes(order.id)) continue;
      const dueDate = order.confirmedDeliveryDate ?? order.requestedDeliveryDate;
      const completedAt = firstCompletionByOrder.get(order.id);
      if (!completedAt) continue; // no audit trail found -- inconclusive, exclude rather than guess
      counted += 1;
      if (completedAt.getTime() <= dueDate.getTime()) onTime += 1;
    }
    otifPct = counted > 0 ? roundPct((onTime / counted) * 100) : null;
  }

  // Past-Due Orders -- a live snapshot of the current backlog (the doc itself frames
  // this as a daily/weekly-checked number, not a week-scoped total), reusing the same
  // risk computation the Customer Orders and Control Tower pages already show.
  const activeOrders = await getActiveOrdersWithRisk();
  const pastDueOrders = activeOrders.filter((o) => o.risk.overdue).length;

  // Material Availability % -- live snapshot across every active order's lines.
  // Re-checks each order's material lines directly (same helper getActiveOrdersWithRisk
  // already used internally) rather than widening that function's return shape.
  const materialChecksPerOrder = await Promise.all(activeOrders.map((o) => getOrderMaterialChecks(o.id)));
  let totalLines = 0;
  let readyLines = 0;
  for (const checks of materialChecksPerOrder) {
    for (const check of Object.values(checks)) {
      totalLines += 1;
      if (check.lineStatus === "READY") readyLines += 1;
    }
  }
  const materialAvailabilityPct = totalLines > 0 ? roundPct((readyLines / totalLines) * 100) : null;

  // Critical Shortages -- materials in the Material Shortage Register at Red risk
  // level (net short across every active order, needed within 7 days). Switched from
  // counting manually-logged Site Action Log entries to this real computed number once
  // the Material Shortage Register existed to provide it -- no more depending on
  // someone remembering to log a shortage as an action.
  const shortages = await listMaterialShortages();
  const criticalShortages = shortages.filter((s) => s.riskLevel === "RED").length;

  // Production Attainment % -- Daily Operations planned vs actual quantity, summed
  // across every task logged in the week.
  const dailyTasks = await prisma.dailyTask.findMany({
    where: { date: { gte: start, lt: end } },
    select: { targetQty: true, actualQty: true },
  });
  const targetSum = dailyTasks.reduce((sum, t) => sum + (t.targetQty ?? 0), 0);
  const actualSum = dailyTasks.reduce((sum, t) => sum + t.actualQty, 0);
  const productionAttainmentPct = targetSum > 0 ? roundPct((actualSum / targetSum) * 100) : null;

  // Average Yield % -- Blending-stage yield (actual produced / theoretical) for every
  // Mfg Reconciliation batch blended this week. Encapsulation/Bottling yield formulas
  // involve capsule-count conversions verified against Dhanu's real paper forms and
  // aren't reused here to avoid misrepresenting a stage-specific formula as a general one.
  const blends = await prisma.mfgBlending.findMany({
    where: { blendedAt: { gte: start, lt: end } },
    select: { totalBlendProducedKg: true, totalTheoreticalWeightKg: true },
  });
  const yields = blends.map((b) => computeYieldPct(b.totalBlendProducedKg, b.totalTheoreticalWeightKg)).filter((y): y is number => y != null);
  const averageYieldPct = yields.length > 0 ? roundPct(yields.reduce((sum, y) => sum + y, 0) / yields.length) : null;

  return { otifPct, pastDueOrders, materialAvailabilityPct, criticalShortages, productionAttainmentPct, averageYieldPct };
}

export type WeeklyKpiScorecardInput = {
  otifPct?: number | null;
  scheduleAdherencePct?: number | null;
  materialAvailabilityPct?: number | null;
  productionAttainmentPct?: number | null;
  averageYieldPct?: number | null;
  qcOnTimeReleasePct?: number | null;
  inventoryAccuracyPct?: number | null;
  pastDueOrders?: number | null;
  criticalShortages?: number | null;
  unplannedScheduleChanges?: number | null;
  overallStatus: EscalationLevel;
  managementComment?: string | null;
};

export async function upsertWeeklyKpiScorecard(weekEndingIso: string, data: WeeklyKpiScorecardInput) {
  const session = await requireAccess();
  const weekEnding = new Date(weekEndingIso);

  const payload = { ...data, managementComment: data.managementComment?.trim() || null };

  const entry = await prisma.weeklyKpiScorecard.upsert({
    where: { weekEnding },
    create: { weekEnding, ...payload, createdById: session.userId, createdByName: session.fullName },
    update: payload,
  });

  await logAudit(session, {
    action: "SAVE_WEEKLY_KPI_SCORECARD",
    entityType: "WeeklyKpiScorecard",
    entityId: entry.id,
    summary: `Weekly KPI Scorecard saved for week ending ${weekEnding.toDateString()} (${data.overallStatus})`,
  });

  revalidatePath(BASE_PATH);
  return entry;
}

export async function deleteWeeklyKpiScorecard(id: string) {
  const session = await requireAccess();

  const entry = await prisma.weeklyKpiScorecard.findUnique({ where: { id }, select: { weekEnding: true } });
  if (!entry) throw new Error("Scorecard not found");

  await prisma.weeklyKpiScorecard.delete({ where: { id } });

  await logAudit(session, {
    action: "DELETE_WEEKLY_KPI_SCORECARD",
    entityType: "WeeklyKpiScorecard",
    entityId: id,
    summary: `Weekly KPI Scorecard for week ending ${entry.weekEnding.toDateString()} deleted`,
  });

  revalidatePath(BASE_PATH);
}
