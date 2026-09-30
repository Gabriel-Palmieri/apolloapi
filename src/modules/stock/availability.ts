export interface Reservation {
  id: string;
  startDate: Date | null;
  endDate: Date | null;
  pickedUpAt: Date | null;
}
const DAY = 86400000;
// Sweep line: count concurrent units, not every reservation intersecting a long interval.
export function occupancy(
  reservations: Reservation[],
  from: Date,
  to: Date | null,
  now: Date,
) {
  const events = new Map<number, number>();
  const overdueIds: string[] = [];
  const lower = from.getTime(),
    upper = to?.getTime() ?? Infinity;
  for (const row of reservations) {
    if (!row.startDate || !row.endDate) continue;
    const overdue = !!row.pickedUpAt && row.endDate < now;
    const start = Math.max(lower, row.startDate.getTime());
    const end = Math.min(upper, overdue ? Infinity : row.endDate.getTime());
    if (start > end) continue;
    if (overdue) overdueIds.push(row.id);
    events.set(start, (events.get(start) ?? 0) + 1);
    if (Number.isFinite(end))
      events.set(end + DAY, (events.get(end + DAY) ?? 0) - 1);
  }
  let count = 0,
    peak = 0;
  for (const [, delta] of [...events].sort(([a], [b]) => a - b)) {
    count += delta;
    peak = Math.max(peak, count);
  }
  return { peak, overdueIds };
}
