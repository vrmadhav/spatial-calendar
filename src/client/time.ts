import type { CalendarEvent } from '../shared/contracts';

const DAY = 86_400_000;
export function dayNumber(date: string): number {
  const value = Date.parse(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(value) || new Date(value).toISOString().slice(0, 10) !== date) throw new Error('Invalid calendar date');
  return value / DAY;
}
export function dateAt(day: number): string { return new Date(Math.floor(day) * DAY).toISOString().slice(0, 10); }
export function zonedDate(instant: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(instant));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function civilCoordinate(instant: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant));
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return dayNumber(zonedDate(instant, timeZone)) + (part('hour') * 60 + part('minute')) / 1440;
}
export function eventBounds(event: CalendarEvent, timeZone: string): [number, number] {
  return event.time.kind === 'allDay' ? [dayNumber(event.time.startDate), dayNumber(event.time.endDate)] : [civilCoordinate(event.time.start, timeZone), civilCoordinate(event.time.end, timeZone)];
}
export function overview(today: string): { origin: number; days: number } {
  const date = new Date(`${today}T00:00:00Z`);
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1) / DAY;
  const end = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 2, 1) / DAY;
  return { origin: start, days: end - start };
}
export function zoomOrigin(origin: number, oldScale: number, newScale: number, anchorPixel: number): number {
  return origin + anchorPixel / oldScale - anchorPixel / newScale;
}
export function conflictIds(events: CalendarEvent[]): Set<string> {
  const result = new Set<string>();
  const timed = events.filter((event) => event.time.kind === 'timed');
  for (let i = 0; i < timed.length; i++) {
    const a = timed[i]!;
    if (a.time.kind !== 'timed') continue;
    for (let j = i + 1; j < timed.length; j++) {
      const b = timed[j]!;
      if (b.time.kind === 'timed' && a.time.start < b.time.end && b.time.start < a.time.end && a.participantIds.some((id) => b.participantIds.includes(id))) { result.add(a.id); result.add(b.id); }
    }
  }
  return result;
}
export function dateLabel(day: number, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(new Date(Math.floor(day) * DAY));
}
export function distanceLabel(day: number, today: string): string {
  const distance = Math.floor(day) - dayNumber(today);
  return distance === 0 ? 'Today' : distance === 1 ? 'Tomorrow' : distance === -1 ? 'Yesterday' : distance > 0 ? `In ${distance} days` : `${-distance} days ago`;
}
export function eventTimeLabel(event: CalendarEvent, zone: string): string {
  if (event.time.kind === 'allDay') {
    const start = dayNumber(event.time.startDate), end = dayNumber(event.time.endDate) - 1;
    return start === end ? `${dateLabel(start)} · All day` : `${dateLabel(start)} – ${dateLabel(end)} · All day`;
  }
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: zone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  return `${formatter.format(new Date(event.time.start))} – ${formatter.format(new Date(event.time.end))}`;
}
