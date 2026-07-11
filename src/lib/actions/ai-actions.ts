"use server";

import { prisma } from "@/lib/prisma";
import { getSession, canEdit } from "@/lib/auth";

const CAPACITY_PER_EMPLOYEE = 8;

/**
 * Rule-based (not LLM-powered) workload balancer. Flags over/under-loaded
 * employees and days for this team/week. A future pass could swap this for
 * a real LLM call given an Anthropic API key, but this needs no external
 * credentials and is fully deterministic.
 */
export async function suggestWeeklyBalance(weekStartStr: string, teamId: string) {
  const session = await getSession();
  if (!session || !canEdit(session.role)) throw new Error("Not authorized");

  const weekStart = new Date(`${weekStartStr}T00:00:00`);

  const [employees, assignments] = await Promise.all([
    prisma.employee.findMany({ where: { teamId, active: true } }),
    prisma.weeklyAssignment.findMany({ where: { weekStart, teamId } }),
  ]);

  if (employees.length === 0) {
    return "No active employees in this team yet — add employees before requesting a balance suggestion.";
  }

  const hoursByEmployee = new Map<string, number>();
  for (const e of employees) hoursByEmployee.set(e.id, 0);
  for (const a of assignments) {
    hoursByEmployee.set(a.employeeId, (hoursByEmployee.get(a.employeeId) ?? 0) + a.hours);
  }

  const totalHours = assignments.reduce((s, a) => s + a.hours, 0);
  const avg = totalHours / employees.length;

  const overloaded: string[] = [];
  const underloaded: string[] = [];
  for (const e of employees) {
    const hours = hoursByEmployee.get(e.id) ?? 0;
    if (avg > 0 && hours > avg * 1.25) {
      overloaded.push(`${e.name} (${hours}h, avg ${avg.toFixed(1)}h)`);
    } else if (hours < avg * 0.6) {
      underloaded.push(`${e.name} (${hours}h, avg ${avg.toFixed(1)}h)`);
    }
  }

  const hoursByDay = new Map<number, number>();
  for (const a of assignments) {
    hoursByDay.set(a.dayOfWeek, (hoursByDay.get(a.dayOfWeek) ?? 0) + a.hours);
  }
  const dayCapacity = employees.length * CAPACITY_PER_EMPLOYEE;
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const overCapacityDays: string[] = [];
  const spareCapacityDays: string[] = [];
  for (let d = 0; d < 7; d++) {
    const hours = hoursByDay.get(d) ?? 0;
    if (hours > dayCapacity) overCapacityDays.push(`${dayLabels[d]} (${hours}h/${dayCapacity}h)`);
    else if (hours < dayCapacity * 0.5) spareCapacityDays.push(`${dayLabels[d]} (${hours}h/${dayCapacity}h)`);
  }

  const lines: string[] = [];
  if (overloaded.length === 0 && underloaded.length === 0) {
    lines.push("Workload looks evenly balanced across the team this week.");
  } else {
    if (overloaded.length) lines.push(`Overloaded: ${overloaded.join(", ")}.`);
    if (underloaded.length) lines.push(`Under-utilised: ${underloaded.join(", ")}.`);
    if (overloaded.length && underloaded.length) {
      lines.push(
        `Suggestion: move a shift or two from ${overloaded[0].split(" (")[0]} to ${underloaded[0].split(" (")[0]} to even things out.`
      );
    }
  }
  if (overCapacityDays.length) {
    lines.push(`Over capacity: ${overCapacityDays.join(", ")} — consider redistributing to ${spareCapacityDays[0]?.split(" (")[0] ?? "a quieter day"}.`);
  } else if (spareCapacityDays.length) {
    lines.push(`Spare capacity available on ${spareCapacityDays.join(", ")}.`);
  }

  return lines.join("\n");
}
