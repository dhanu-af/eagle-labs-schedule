/** Truncates a Date to its UTC calendar-day key (YYYY-MM-DD) -- used to match a
 * BatchRecord.scheduledDate / MachineCapacityException.date against a specific day
 * regardless of the time-of-day component Postgres stores alongside it. */
export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** The Monday (UTC calendar day) of the week containing `date` -- kept in this module's
 * own UTC-day convention (toDateKey/addDays) rather than week-utils.ts's local-date one,
 * so the weekly rollup never straddles a UTC/local timezone mismatch against the daily
 * overview's UTC-keyed cells. */
export function mostRecentMondayUTC(date: Date): Date {
  const d = new Date(`${toDateKey(date)}T00:00:00.000Z`);
  const day = d.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  return addDays(d, -daysSinceMonday);
}

export type MachineCapacitySnapshot = {
  availableHours: number;
  scheduledHours: number;
  remainingHours: number;
  /** null when availableHours is 0 and there's nothing scheduled (nothing to divide) --
   * render as "—", not 0%, since 0% would wrongly imply spare capacity. */
  utilizationPct: number | null;
  overload: boolean;
};

/** Pure capacity math -- never persisted, matches this repo's existing convention of
 * computing yield%/reconciliation/order-risk figures at render time instead of storing
 * them, so they can never drift out of sync with the real schedule. */
export function computeMachineCapacity(availableHours: number, scheduledHours: number): MachineCapacitySnapshot {
  const remainingHours = Math.round((availableHours - scheduledHours) * 100) / 100;
  const utilizationPct = availableHours > 0 ? Math.round((scheduledHours / availableHours) * 1000) / 10 : scheduledHours > 0 ? null : 0;
  return { availableHours, scheduledHours, remainingHours, utilizationPct, overload: remainingHours < 0 };
}
