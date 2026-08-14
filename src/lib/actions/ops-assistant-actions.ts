"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { askDhanu, type KbMatch } from "@/lib/actions/kb-actions";
import { getActiveOrdersWithRisk } from "@/lib/actions/customer-order-actions";
import { getCapacityOverview } from "@/lib/actions/capacity-planning-actions";
import { toDateKey } from "@/lib/capacity-planning-defaults";

export type OpsAnswer = { liveAnswer: string | null; liveLink: string | null; matches: KbMatch[]; confident: boolean };

type ActiveOrder = Awaited<ReturnType<typeof getActiveOrdersWithRisk>>[number];

function formatOrderList(orders: ActiveOrder[], reasonFn: (o: ActiveOrder) => string): string {
  return orders.map((o) => `${o.orderNumber} (${o.customerName}) — ${reasonFn(o)}`).join("\n");
}

/** Looks up a specific order/PO number mentioned in the question -- takes priority over
 * keyword intents since a direct reference is the most specific thing the question could
 * mean. Returns null if no CO-/PO- pattern is found, so keyword matching runs next. */
async function tryOrderOrPoLookup(question: string): Promise<{ answer: string; link: string | null } | null> {
  const coMatch = question.match(/\bCO-\d{4}-\d+\b/i);
  if (coMatch) {
    const orderNumber = coMatch[0].toUpperCase();
    const order = await prisma.customerOrder.findFirst({ where: { orderNumber: { equals: orderNumber, mode: "insensitive" } }, include: { customer: true } });
    if (!order) return { answer: `I couldn't find an order numbered ${orderNumber}.`, link: null };

    const active = (await getActiveOrdersWithRisk()).find((o) => o.id === order.id);
    if (!active) {
      return { answer: `${orderNumber} (${order.customer.name}) is ${order.status} — no longer being tracked for delivery risk.`, link: `/customer-orders/${order.id}` };
    }
    const reasons = [...active.risk.reasons];
    if (active.qaStatus === "HELD") reasons.push("has a QA hold on a linked batch");
    return {
      answer:
        reasons.length === 0
          ? `${orderNumber} (${order.customer.name}) looks on track — no material, capacity, or QA issues detected right now.`
          : `${orderNumber} (${order.customer.name}) — ${reasons.join("; ")}.`,
      link: `/customer-orders/${order.id}`,
    };
  }

  const poMatch = question.match(/\bPO-\d{4}-\d+\b/i);
  if (poMatch) {
    const poNumber = poMatch[0].toUpperCase();
    const po = await prisma.purchaseOrder.findFirst({ where: { poNumber: { equals: poNumber, mode: "insensitive" } }, include: { supplier: true, lines: { include: { item: true } } } });
    if (!po) return { answer: `I couldn't find a purchase order numbered ${poNumber}.`, link: null };
    const lines = po.lines.map((l) => `${l.item.name} (${l.quantity} ${l.unit})`).join(", ");
    return {
      answer: `${poNumber} to ${po.supplier.name} — status ${po.status}, expected ${po.expectedDeliveryDate.toLocaleDateString()}. Lines: ${lines || "none"}.`,
      link: "/procurement",
    };
  }

  return null;
}

async function tryKeywordIntent(question: string): Promise<{ answer: string; link: string | null } | null> {
  const q = question.toLowerCase();

  if (q.includes("bottleneck") || q.includes("overload") || q.includes("which machine")) {
    const overview = await getCapacityOverview(new Date(), 1);
    const todayKey = toDateKey(new Date());
    const rows = overview.rows.map((r) => ({ name: r.name, cell: r.cells[todayKey] })).filter((r) => r.cell);
    if (rows.length === 0) return { answer: "No machines are set up yet in Capacity Planning.", link: "/capacity-planning" };
    const worst = rows.reduce((a, b) => ((b.cell!.utilizationPct ?? 0) > (a.cell!.utilizationPct ?? 0) ? b : a));
    const pct = worst.cell!.utilizationPct;
    return {
      answer:
        pct === null
          ? `${worst.name} has nothing scheduled today, and neither does anything else — no bottleneck right now.`
          : `${worst.name} is today's tightest resource at ${pct}% utilisation (${worst.cell!.scheduledHours}h scheduled of ${worst.cell!.availableHours}h available)${worst.cell!.overload ? " — it's overloaded." : "."}`,
      link: "/capacity-planning",
    };
  }

  if (q.includes("overdue")) {
    const orders = (await getActiveOrdersWithRisk()).filter((o) => o.risk.overdue);
    return {
      answer: orders.length === 0 ? "No active orders are currently overdue." : `${orders.length} order(s) overdue:\n${formatOrderList(orders, (o) => o.risk.reasons.join("; "))}`,
      link: "/customer-orders",
    };
  }

  if (q.includes("qa hold") || q.includes("quality hold") || (q.includes("held") && q.includes("qa"))) {
    const orders = (await getActiveOrdersWithRisk()).filter((o) => o.qaStatus === "HELD");
    return {
      answer: orders.length === 0 ? "No active orders are currently on QA hold." : `${orders.length} order(s) on QA hold:\n${formatOrderList(orders, () => "linked batch failed QC, needs review")}`,
      link: "/customer-orders",
    };
  }

  if (q.includes("shortage") || q.includes("material") || q.includes("short on")) {
    const orders = (await getActiveOrdersWithRisk()).filter((o) => o.shortLineCount > 0);
    return {
      answer:
        orders.length === 0
          ? "No active orders are currently short on raw material."
          : `${orders.length} order(s) affected by a material shortage:\n${formatOrderList(orders, (o) => `${o.shortLineCount} line(s) short`)}\nCheck Procurement for incoming POs covering these.`,
      link: "/customer-orders",
    };
  }

  if (q.includes("on time") || q.includes("on-time")) {
    const orders = await getActiveOrdersWithRisk();
    if (orders.length === 0) return { answer: "There are no active orders right now.", link: "/customer-orders" };
    const onTrack = orders.filter((o) => !o.risk.overdue && !o.risk.atRisk).length;
    return { answer: `${onTrack} of ${orders.length} active orders (${Math.round((onTrack / orders.length) * 100)}%) are on track — neither overdue nor at risk.`, link: "/customer-orders" };
  }

  if (q.includes("at risk") || q.includes("risk this week") || (q.includes("risk") && !q.includes("overdue"))) {
    const orders = (await getActiveOrdersWithRisk()).filter((o) => o.risk.atRisk && !o.risk.overdue);
    return {
      answer: orders.length === 0 ? "No active orders are currently at risk of missing their delivery date." : `${orders.length} order(s) at risk:\n${formatOrderList(orders, (o) => o.risk.reasons.join("; "))}`,
      link: "/customer-orders",
    };
  }

  return null;
}

/** Rule-based (not LLM-powered, matching this repo's existing askDhanu convention) live
 * operations query router. Tries a direct order/PO lookup first, then keyword intents
 * against the same real data the Control Tower displays, falling back to the existing
 * static-knowledge-base matcher untouched if nothing live matches. */
export async function askOpsAssistant(question: string): Promise<OpsAnswer> {
  const session = await getSession();
  if (!session) throw new Error("Not authorized");

  const live = (await tryOrderOrPoLookup(question)) ?? (await tryKeywordIntent(question));
  if (live) {
    return { liveAnswer: live.answer, liveLink: live.link, matches: [], confident: false };
  }

  const kb = await askDhanu(question);
  return { liveAnswer: null, liveLink: null, ...kb };
}
