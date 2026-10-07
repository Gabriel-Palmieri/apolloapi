import type { Reservation } from './availability.js';

// Index overloaded intervals once per size; query each reservation in O(log n).
export function conflictWindows(rows: Reservation[], capacity: number, now: Date) {
  const events = new Map<number, number>();
  const overdueIds: string[] = [];
  const day = 86400000;
  for (const row of rows) {
    if (!row.startDate || !row.endDate) continue;
    const start = row.startDate.getTime();
    const overdue = !!row.pickedUpAt && row.endDate < now;
    const end = overdue ? Infinity : row.endDate.getTime();
    if (end < start) continue;
    if (overdue) overdueIds.push(row.id);
    events.set(start, (events.get(start) ?? 0) + 1);
    if (Number.isFinite(end)) events.set(end + day, (events.get(end + day) ?? 0) - 1);
  }
  const points = [...events].sort(([a], [b]) => a - b);
  const windows: [number, number][] = [];
  let active = 0;
  for (let i = 0; i < points.length; i++) {
    active += points[i][1];
    if (active > capacity) windows.push([points[i][0], i + 1 < points.length ? points[i + 1][0] - day : Infinity]);
  }
  return { overdueIds, overlaps(from: Date, to: Date) {
    let left = 0, right = windows.length;
    while (left < right) {
      const middle = Math.floor((left + right) / 2);
      if (windows[middle][1] < from.getTime()) left = middle + 1;
      else right = middle;
    }
    return left < windows.length && windows[left][0] <= to.getTime();
  } };
}
