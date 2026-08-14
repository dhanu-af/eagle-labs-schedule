/** Shared Monday -> Sunday week math, used by both the Weekly KPI Scorecard and the
 * Weekly MPS -- matches the Planning Calendar's MON..SUN row layout. A week's identity
 * is always its Sunday ("weekEnding"), stored at local midnight. */
export function weekEndingFor(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = Sunday .. 6 = Saturday
  const daysToSunday = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + daysToSunday);
  return d;
}

export function currentWeekEnding(): Date {
  return weekEndingFor(new Date());
}

/** [start, end) bounds for the Monday..Sunday week ending on weekEnding -- end is
 * exclusive (the following Monday midnight) so it's a plain `gte`/`lt` range. */
export function weekBounds(weekEnding: Date): { start: Date; end: Date } {
  const end = new Date(weekEnding);
  end.setDate(end.getDate() + 1); // Monday after, exclusive upper bound
  const start = new Date(weekEnding);
  start.setDate(start.getDate() - 6); // Monday of that week
  return { start, end };
}

export function formatWeekLabel(weekEnding: Date): string {
  const { start } = weekBounds(weekEnding);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(weekEnding)}, ${weekEnding.getFullYear()}`;
}

export function roundPct(value: number): number {
  return Math.round(value * 10) / 10;
}

export function addWeeks(weekEnding: Date, delta: number): Date {
  const d = new Date(weekEnding);
  d.setDate(d.getDate() + delta * 7);
  return d;
}
