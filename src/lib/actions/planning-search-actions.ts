"use server";

import { prisma } from "@/lib/prisma";
import { getActiveOrdersWithRisk } from "@/lib/actions/customer-order-actions";
import { listMaterialShortages } from "@/lib/actions/material-shortage-actions";
import { CUSTOMER_ORDER_STATUS_LABELS } from "@/lib/customer-order-defaults";
import { ACTION_LOG_STATUS_LABELS, ESCALATION_LEVEL_LABELS as ACTION_ESCALATION_LABELS, PRIORITY_LABELS as ACTION_PRIORITY_LABELS } from "@/lib/action-log-defaults";
import { PRIORITY_LABELS as MPS_PRIORITY_LABELS } from "@/lib/weekly-mps-defaults";
import { ESCALATION_LEVEL_LABELS as SHORTAGE_RISK_LABELS, WATCH_STATUS_LABELS } from "@/lib/material-shortage-defaults";
import { STATUS_LABEL as DAILY_STATUS_LABEL, PRIORITY_LABEL as DAILY_PRIORITY_LABEL, toDateInputValue } from "@/lib/ui";

/** Local-calendar-day key (YYYY-MM-DD) -- this module is entirely self-contained
 * (own day bucketing, not shared with capacity-planning-defaults.ts's UTC convention
 * or week-utils.ts's week-level one) since it operates at single-day granularity
 * across five otherwise-unrelated models. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayRange(dateKey: string): { gte: Date; lt: Date } {
  const start = new Date(`${dateKey}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { gte: start, lt: end };
}

// ---------------------------------------------------------------------------
// Top summary counters -- mirrors the spreadsheet's "Past-Due Orders / Red
// Material Risks / Blocked MPS / Open Red Actions" header row. Pure composition
// over functions the other four registers already expose; no new queries beyond
// what those already run.
// ---------------------------------------------------------------------------

export type PlanningSummaryCounts = { pastDueOrders: number; redMaterialRisks: number; blockedMps: number; openRedActions: number };

export async function getPlanningSummaryCounts(): Promise<PlanningSummaryCounts> {
  const [activeOrders, shortages, mpsEntries, redActions] = await Promise.all([
    getActiveOrdersWithRisk(),
    listMaterialShortages(),
    prisma.weeklyMpsEntry.findMany({ where: { weekEnding: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }, select: { frozen: true, qcReady: true, maintenanceReady: true } }),
    prisma.siteActionLog.count({ where: { escalationLevel: "RED", status: { in: ["OPEN", "IN_PROGRESS"] } } }),
  ]);

  return {
    pastDueOrders: activeOrders.filter((o) => o.risk.overdue).length,
    redMaterialRisks: shortages.filter((s) => s.riskLevel === "RED").length,
    blockedMps: mpsEntries.filter((e) => !e.frozen || !e.qcReady || !e.maintenanceReady).length,
    openRedActions: redActions,
  };
}

// ---------------------------------------------------------------------------
// Calendar -- per-day counts of Orders/MPS/Production/Actions across a 6-week
// (42-day) Monday-start grid covering the given month, matching the spreadsheet's
// fixed MON..SUN layout.
// ---------------------------------------------------------------------------

export type CalendarDayCounts = { dateKey: string; inMonth: boolean; orders: number; mps: number; production: number; actions: number };

function startOfMonthGridMonday(monthDate: Date): Date {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const day = first.getDay(); // 0 = Sunday .. 6 = Saturday
  const daysBack = day === 0 ? 6 : day - 1;
  const start = new Date(first);
  start.setDate(start.getDate() - daysBack);
  return start;
}

export async function getPlanningCalendar(monthDate: Date): Promise<{ days: CalendarDayCounts[] }> {
  const gridStart = startOfMonthGridMonday(monthDate);
  const gridEnd = new Date(gridStart);
  gridEnd.setDate(gridEnd.getDate() + 42);

  const [orders, mpsEntries, dailyTasks, actions] = await Promise.all([
    prisma.customerOrder.findMany({
      where: { OR: [{ confirmedDeliveryDate: { gte: gridStart, lt: gridEnd } }, { AND: [{ confirmedDeliveryDate: null }, { requestedDeliveryDate: { gte: gridStart, lt: gridEnd } }] }] },
      select: { requestedDeliveryDate: true, confirmedDeliveryDate: true },
    }),
    prisma.weeklyMpsEntry.findMany({ where: { requiredDate: { gte: gridStart, lt: gridEnd } }, select: { requiredDate: true } }),
    prisma.dailyTask.findMany({ where: { date: { gte: gridStart, lt: gridEnd } }, select: { date: true } }),
    prisma.siteActionLog.findMany({ where: { OR: [{ dateRaised: { gte: gridStart, lt: gridEnd } }, { dueDate: { gte: gridStart, lt: gridEnd } }] }, select: { dateRaised: true, dueDate: true } }),
  ]);

  const counts = new Map<string, CalendarDayCounts>();
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    const key = dayKey(d);
    counts.set(key, { dateKey: key, inMonth: d.getMonth() === monthDate.getMonth(), orders: 0, mps: 0, production: 0, actions: 0 });
  }

  for (const o of orders) {
    const key = dayKey(o.confirmedDeliveryDate ?? o.requestedDeliveryDate);
    const cell = counts.get(key);
    if (cell) cell.orders += 1;
  }
  for (const m of mpsEntries) {
    if (!m.requiredDate) continue;
    const cell = counts.get(dayKey(m.requiredDate));
    if (cell) cell.mps += 1;
  }
  for (const t of dailyTasks) {
    const cell = counts.get(dayKey(t.date));
    if (cell) cell.production += 1;
  }
  for (const a of actions) {
    const raisedKey = dayKey(a.dateRaised);
    const raisedCell = counts.get(raisedKey);
    if (raisedCell) raisedCell.actions += 1;
    if (a.dueDate) {
      const dueKey = dayKey(a.dueDate);
      if (dueKey !== raisedKey) {
        const dueCell = counts.get(dueKey);
        if (dueCell) dueCell.actions += 1;
      }
    }
  }

  return { days: Array.from(counts.values()) };
}

// ---------------------------------------------------------------------------
// Unified search -- one row shape across five otherwise-separate registers,
// matching the spreadsheet's "Date / Section / Reference / Description / Area-
// Owner / Status / Risk-Priority / Notes" search-results columns.
// ---------------------------------------------------------------------------

export type PlanningSection = "DEMAND" | "MPS" | "MATERIALS" | "PRODUCTION" | "ACTIONS" | "KPI";

export type PlanningSearchRow = {
  date: string | null;
  section: PlanningSection;
  reference: string;
  description: string;
  areaOwner: string;
  status: string;
  riskPriority: string;
  notes: string | null;
  href: string;
};

export type PlanningSearchFilters = { keyword?: string; section?: PlanningSection | "ALL"; date?: string | null };

const CI = { mode: "insensitive" as const };

export async function searchPlanningRecords(filters: PlanningSearchFilters): Promise<PlanningSearchRow[]> {
  const keyword = filters.keyword?.trim() || undefined;
  const section = filters.section ?? "ALL";
  const dateFilter = filters.date ? dayRange(filters.date) : undefined;

  const rows: PlanningSearchRow[] = [];
  const wantsSection = (s: PlanningSection) => section === "ALL" || section === s;

  if (wantsSection("DEMAND")) {
    const orders = await prisma.customerOrder.findMany({
      where: {
        ...(keyword ? { OR: [{ orderNumber: { contains: keyword, ...CI } }, { customer: { name: { contains: keyword, ...CI } } }] } : {}),
        ...(dateFilter ? { OR: [{ confirmedDeliveryDate: dateFilter }, { requestedDeliveryDate: dateFilter }] } : {}),
      },
      include: { customer: true, responsiblePlanner: true },
      orderBy: { requestedDeliveryDate: "asc" },
      take: 100,
    });
    for (const o of orders) {
      rows.push({
        date: (o.confirmedDeliveryDate ?? o.requestedDeliveryDate).toISOString(),
        section: "DEMAND",
        reference: o.orderNumber,
        description: `${o.customer.name} order`,
        areaOwner: o.responsiblePlanner?.fullName ?? "Unassigned",
        status: CUSTOMER_ORDER_STATUS_LABELS[o.status],
        riskPriority: o.priority,
        notes: o.notes,
        href: `/customer-orders/${o.id}`,
      });
    }
  }

  if (wantsSection("MPS")) {
    const entries = await prisma.weeklyMpsEntry.findMany({
      where: {
        ...(keyword ? { product: { name: { contains: keyword, ...CI } } } : {}),
        ...(dateFilter ? { requiredDate: dateFilter } : {}),
      },
      include: { product: true, machine: true },
      orderBy: { weekEnding: "desc" },
      take: 100,
    });
    for (const e of entries) {
      rows.push({
        date: (e.requiredDate ?? e.weekEnding).toISOString(),
        section: "MPS",
        reference: e.product.name,
        description: `${e.plannedBatches} batch${e.plannedBatches === 1 ? "" : "es"} x ${e.batchSizeKg}kg`,
        areaOwner: e.machine ? `${e.machine.name} (${e.machine.code})` : "Unassigned line",
        status: e.frozen ? "Frozen" : "Flexible",
        riskPriority: MPS_PRIORITY_LABELS[e.priority],
        notes: e.notes,
        href: `/weekly-mps?week=${e.weekEnding.toISOString().slice(0, 10)}`,
      });
    }
  }

  if (wantsSection("MATERIALS") && !dateFilter) {
    // Live-computed, not a stored/dated record -- date filtering doesn't apply.
    const shortages = await listMaterialShortages();
    const filtered = keyword ? shortages.filter((s) => `${s.itemCode} ${s.itemName}`.toLowerCase().includes(keyword.toLowerCase())) : shortages;
    for (const s of filtered) {
      rows.push({
        date: s.earliestNeedDate,
        section: "MATERIALS",
        reference: s.itemCode,
        description: s.itemName,
        areaOwner: s.watchOwner ?? "Unassigned",
        status: s.watchStatus ? WATCH_STATUS_LABELS[s.watchStatus] : "Not tracked",
        riskPriority: SHORTAGE_RISK_LABELS[s.riskLevel],
        notes: s.watchAction,
        href: "/material-shortages",
      });
    }
  }

  if (wantsSection("PRODUCTION")) {
    const tasks = await prisma.dailyTask.findMany({
      where: {
        ...(keyword ? { OR: [{ product: { contains: keyword, ...CI } }, { batchNo: { contains: keyword, ...CI } }] } : {}),
        ...(dateFilter ? { date: dateFilter } : {}),
      },
      include: { team: true, employee: true },
      orderBy: { date: "desc" },
      take: 100,
    });
    for (const t of tasks) {
      rows.push({
        date: t.date.toISOString(),
        section: "PRODUCTION",
        reference: t.batchNo ?? t.product,
        description: `${t.product} · ${t.process}`,
        areaOwner: t.employee?.name ?? t.team.name,
        status: DAILY_STATUS_LABEL[t.status],
        riskPriority: DAILY_PRIORITY_LABEL[t.priority],
        notes: t.delayReason ?? t.notes,
        href: `/daily?date=${toDateInputValue(t.date)}`,
      });
    }
  }

  if (wantsSection("ACTIONS")) {
    const actions = await prisma.siteActionLog.findMany({
      where: {
        ...(keyword ? { issue: { contains: keyword, ...CI } } : {}),
        ...(dateFilter ? { OR: [{ dateRaised: dateFilter }, { dueDate: dateFilter }] } : {}),
      },
      orderBy: { dateRaised: "desc" },
      take: 100,
    });
    for (const a of actions) {
      rows.push({
        date: (a.dueDate ?? a.dateRaised).toISOString(),
        section: "ACTIONS",
        reference: a.actionNumber,
        description: a.issue,
        areaOwner: a.owner,
        status: ACTION_LOG_STATUS_LABELS[a.status],
        riskPriority: `${ACTION_PRIORITY_LABELS[a.priority]} / ${ACTION_ESCALATION_LABELS[a.escalationLevel]}`,
        notes: a.resolution,
        href: "/action-log",
      });
    }
  }

  if (wantsSection("KPI")) {
    const kpis = await prisma.weeklyKpiScorecard.findMany({
      where: {
        ...(keyword ? { managementComment: { contains: keyword, ...CI } } : {}),
        ...(dateFilter ? { weekEnding: dateFilter } : {}),
      },
      orderBy: { weekEnding: "desc" },
      take: 50,
    });
    for (const k of kpis) {
      rows.push({
        date: k.weekEnding.toISOString(),
        section: "KPI",
        reference: `Week of ${k.weekEnding.toDateString()}`,
        description: `OTIF ${k.otifPct ?? "—"}% · Attainment ${k.productionAttainmentPct ?? "—"}%`,
        areaOwner: k.createdByName ?? "—",
        status: k.overallStatus,
        riskPriority: k.overallStatus,
        notes: k.managementComment,
        href: "/weekly-kpi",
      });
    }
  }

  rows.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return rows;
}
