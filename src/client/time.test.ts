import { describe, expect, it } from 'vitest';
import { civilCoordinate, conflictIds, dateAt, dayNumber, distanceLabel, eventBounds, eventTimeLabel, overview, zonedDate, zoomOrigin } from './time';
import { sampleEvent } from './fixtures.test-support';

describe('civil dates and spatial geometry', () => {
  it('rejects invalid dates and preserves leap dates', () => { expect(() => dayNumber('2026-02-29')).toThrow(); expect(dateAt(dayNumber('2024-02-29'))).toBe('2024-02-29'); });
  it('covers exact previous, current and following calendar months', () => { const value = overview('2026-01-31'); expect(dateAt(value.origin)).toBe('2025-12-01'); expect(dateAt(value.origin + value.days)).toBe('2026-03-01'); });
  it('preserves center within a CSS pixel over presets and continuous scales', () => {
    for (const width of [343, 900, 1440]) {
      let origin = dayNumber('2026-09-01'), scale = width / 91;
      const anchor = origin + width / 2 / scale;
      for (const span of [7, 1, 23.714, 45.68, 91]) { const next = width / span; origin = zoomOrigin(origin, scale, next, width / 2); scale = next; expect(Math.abs((anchor - origin) * scale - width / 2)).toBeLessThan(1); }
    }
  });
  it('uses household dates and equal-width days through DST', () => {
    expect(zonedDate('2026-03-09T06:30:00.000Z', 'America/Los_Angeles')).toBe('2026-03-08');
    expect(civilCoordinate('2026-03-09T07:00:00.000Z', 'America/Los_Angeles') - civilCoordinate('2026-03-08T08:00:00.000Z', 'America/Los_Angeles')).toBe(1);
    expect(distanceLabel(dayNumber('2026-03-09'), '2026-03-08')).toBe('Tomorrow');
  });
  it('keeps all-day dates and exclusive end semantics', () => {
    const event = { ...sampleEvent, time: { kind: 'allDay' as const, startDate: '2026-11-01', endDate: '2026-11-03' } };
    expect(eventBounds(event, 'America/Los_Angeles')).toEqual([dayNumber('2026-11-01'), dayNumber('2026-11-03')]);
    expect(eventTimeLabel(event, 'America/Los_Angeles')).toBe('Nov 1 – Nov 2 · All day');
  });
  it('reports conflicts only for shared people and strict timed overlap', () => {
    const overlap = { ...sampleEvent, id: 'overlap', time: { kind: 'timed' as const, start: '2026-10-25T18:00:00.000Z', end: '2026-10-25T20:00:00.000Z' } };
    const adjacent = { ...sampleEvent, id: 'adjacent', time: { kind: 'timed' as const, start: '2026-10-25T19:00:00.000Z', end: '2026-10-25T20:00:00.000Z' } };
    expect(conflictIds([sampleEvent, overlap])).toEqual(new Set([sampleEvent.id, overlap.id]));
    expect(conflictIds([sampleEvent, adjacent])).toEqual(new Set());
    expect(conflictIds([sampleEvent, { ...overlap, participantIds: ['other'] }])).toEqual(new Set());
    expect(conflictIds([sampleEvent, { ...overlap, time: { kind: 'allDay', startDate: '2026-10-25', endDate: '2026-10-26' } }])).toEqual(new Set());
  });
});
