import { describe, expect, it } from 'vitest';
import { calendarEventSchema, connectAccountRequestSchema, dateSchema, eventTimeSchema, instantSchema, selectSourceRequestSchema, syncAccountRequestSchema } from './contracts.js';

describe('shared boundary schemas', () => {
  it('accepts leap dates and rejects normalized impossible dates', () => {
    expect(dateSchema.safeParse('2024-02-29').success).toBe(true);
    for (const input of ['2025-02-29', '2026-04-31', '2026-13-01', 'not-a-date']) {
      expect(dateSchema.safeParse(input).success).toBe(false);
    }
  });

  it('requires exclusive ends and canonical UTC instants', () => {
    expect(eventTimeSchema.safeParse({ kind: 'allDay', startDate: '2026-10-23', endDate: '2026-10-24' }).success).toBe(true);
    expect(eventTimeSchema.safeParse({ kind: 'allDay', startDate: '2026-10-23', endDate: '2026-10-23' }).success).toBe(false);
    expect(eventTimeSchema.safeParse({ kind: 'timed', start: '2026-10-23T12:00:00.000Z', end: '2026-10-23T13:00:00.000Z' }).success).toBe(true);
    expect(eventTimeSchema.safeParse({ kind: 'timed', start: '2026-10-23T12:00:00-07:00', end: '2026-10-23T13:00:00-07:00' }).success).toBe(false);
  });

  it('limits UTC instants to the contracted four-digit year format', () => {
    for (const input of ['+010000-01-01T00:00:00.000Z', '-000001-01-01T00:00:00.000Z', '2026-10-23T12:00:00Z', '2026-10-23T12:00:00.000+00:00']) {
      expect(instantSchema.safeParse(input).success).toBe(false);
    }
    expect(instantSchema.safeParse('2026-10-23T12:00:00.000Z').success).toBe(true);
    expect(instantSchema.safeParse('2026-02-30T12:00:00.000Z').success).toBe(false);
  });

  it('rejects unknown write fields and coercible values', () => {
    expect(connectAccountRequestSchema.safeParse({ profileId: 'sam', role: 'owner' }).success).toBe(false);
    expect(selectSourceRequestSchema.safeParse({ selected: 'false' }).success).toBe(false);
    expect(syncAccountRequestSchema.safeParse({}).success).toBe(true);
    expect(syncAccountRequestSchema.safeParse({ simulateFailure: 1 }).success).toBe(false);
  });

  it('rejects invalid event bounds and duplicate participant identities', () => {
    const event = {
      id: 'event-1', householdId: 'household-1', sourceId: 'source-1', providerEventId: 'provider-1',
      title: 'A household plan', category: 'social', time: { kind: 'allDay', startDate: '2026-10-23', endDate: '2026-10-24' },
      location: null, participantIds: ['user-1'], notes: '', travel: null,
    };
    expect(calendarEventSchema.safeParse(event).success).toBe(true);
    expect(calendarEventSchema.safeParse({ ...event, participantIds: ['user-1', 'user-1'] }).success).toBe(false);
    expect(calendarEventSchema.safeParse({ ...event, notes: 'x'.repeat(4001) }).success).toBe(false);
  });
});
