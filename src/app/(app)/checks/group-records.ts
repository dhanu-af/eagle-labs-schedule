export type RecordGroup<T> = { key: string; label: string; rows: T[] };

function startOfWeekMonday(d: Date): Date {
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

/** Groups check records by calendar day or by week (Mon–Sun), most recent first. */
export function groupRecordsByPeriod<T>(
  rows: T[],
  getDate: (row: T) => string,
  mode: "day" | "week"
): RecordGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const r of rows) {
    const d = new Date(`${getDate(r).slice(0, 10)}T00:00:00Z`);
    const key = mode === "day" ? d.toISOString().slice(0, 10) : startOfWeekMonday(d).toISOString().slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  return [...groups.keys()]
    .sort((a, b) => (a < b ? 1 : -1))
    .map((key) => {
      if (mode === "day") {
        const d = new Date(`${key}T00:00:00Z`);
        return {
          key,
          label: d.toLocaleDateString("en-AU", { weekday: "long", day: "2-digit", month: "short", year: "numeric" }),
          rows: groups.get(key)!,
        };
      }
      const start = new Date(`${key}T00:00:00Z`);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 6);
      return {
        key,
        label: `Week of ${start.toLocaleDateString("en-AU", { day: "2-digit", month: "short" })} – ${end.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}`,
        rows: groups.get(key)!,
      };
    });
}
