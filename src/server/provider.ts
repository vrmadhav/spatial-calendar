import type { CalendarEvent, CalendarSource, DemoProfile, ExternalAccount } from '../shared/contracts.js';
import { providerUnavailable } from './errors.js';

export type Clock = () => Date;
export interface ProviderSnapshot { sources: CalendarSource[]; events: CalendarEvent[] }
export interface CalendarProvider {
  sync(account: ExternalAccount, now: Date, signal: AbortSignal): Promise<unknown>;
}
export const profiles: readonly DemoProfile[] = [
  { id: 'alex', name: 'Alex Rivera', email: 'alex@family.example', ownerUserId: 'demo-alex' },
  { id: 'jamie', name: 'Jamie Rivera', email: 'jamie@family.example', ownerUserId: 'demo-jamie' },
  { id: 'sam', name: 'Sam Rivera', email: 'sam@family.example', ownerUserId: 'demo-alex' },
];
export function localDate(now: Date, timeZone = 'America/Los_Angeles'): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
// Resolve a civil wall clock in the household's IANA zone. Seed hours avoid DST gaps/folds.
function localInstant(date: string, hour: number, minute = 0): string {
  const target = new Date(`${date}T00:00:00.000Z`).getTime() + (hour * 60 + minute) * 60_000;
  let candidate = target;
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(candidate));
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)!.value;
    const displayed = Date.parse(`${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:00.000Z`);
    candidate += target - displayed;
  }
  return new Date(candidate).toISOString();
}

export function demoProviderSnapshot(account: ExternalAccount, now: Date): ProviderSnapshot {
  const source = (suffix: string, name: string, color: string): CalendarSource => ({ id: `${account.id}-${suffix}`, householdId: account.householdId, accountId: account.id, name, color, selected: true });
  const sources = account.profileId === 'alex'
    ? [source('personal', 'Alex · Personal', '#D97757'), source('travel', 'Family travel', '#B484C4')]
    : account.profileId === 'jamie'
      ? [source('personal', 'Jamie · Personal', '#598C86'), source('school', 'School & activities', '#D5AA51')]
      : [source('personal', 'Sam · Activities', '#788CC4')];
  const today = localDate(now);
  const participants = account.householdId === 'household-rivera' ? ['demo-alex', 'demo-jamie', 'demo-casey'] : ['demo-outsider', 'demo-jamie'];
  const event = (key: string, sourceIndex: number, title: string, day: number, hour: number, duration: number, category: CalendarEvent['category'], overrides: Partial<CalendarEvent> = {}): CalendarEvent => {
    const start = localInstant(addDays(today, day), hour);
    return { id: `${sources[sourceIndex].id}-${key}`, householdId: account.householdId, sourceId: sources[sourceIndex].id, providerEventId: key, title, category,
      time: { kind: 'timed', start, end: new Date(Date.parse(start) + duration * 60_000).toISOString() }, location: 'Rivera neighborhood', participantIds: [account.ownerUserId], notes: 'Synthetic demo event. No external account is connected.', travel: null, ...overrides };
  };
  let events: CalendarEvent[];
  if (account.profileId === 'alex') {
    events = [
      event('coffee', 0, 'Coffee with Maya', -4, 10, 60, 'social', { location: 'Juniper Coffee · 24 Oak Street' }),
      event('dentist', 0, 'Family dentist', 2, 16, 60, 'health', { participantIds: participants.slice(0, 2), location: 'Bright Smile · 420 Cedar Avenue', notes: 'Bring insurance cards. This appointment overlaps rehearsal.' }),
      event('dinner', 0, 'Dinner with the Chens', 8, 18, 90, 'social', { participantIds: participants, location: 'Olive Table · 88 Market Street', travel: { kind: 'reservation', summary: 'Table for six · 6:00 PM', confirmationCode: 'DEMO-TABLE', details: 'Outdoor table requested. All reservation details are simulated.' } }),
      event('flight', 1, 'Fly to Palm Springs', 18, 9, 90, 'travel', { participantIds: participants, location: 'SFO · Terminal 2', notes: 'Arrive two hours early. Pack swimming goggles.', travel: { kind: 'flight', summary: 'SFO → PSP · Demo flight 482', confirmationCode: 'DEMO-FLY', details: 'Departure 9:00 AM; arrival 10:30 AM. Synthetic flight confirmation.' } }),
      event('hotel', 1, 'Desert weekend', 18, 15, 60, 'travel', { participantIds: participants, time: { kind: 'allDay', startDate: addDays(today, 18), endDate: addDays(today, 22) }, location: 'Desert House · 125 Palm Canyon Drive', travel: { kind: 'hotel', summary: 'Four nights · Family suite', confirmationCode: 'DEMO-STAY', details: 'Check-in 3 PM; check-out 11 AM. Breakfast included. Simulated itinerary.' } }),
      event('weekend', 1, 'Coast getaway', 48, 12, 60, 'travel', { participantIds: participants, time: { kind: 'allDay', startDate: addDays(today, 48), endDate: addDays(today, 51) }, location: 'Monterey coast' }),
    ];
  } else if (account.profileId === 'jamie') {
    events = [
      event('walk', 0, 'Morning walk', 0, 8, 45, 'activity'),
      event('rehearsal', 1, 'School rehearsal', 2, 16, 90, 'activity', { participantIds: participants.slice(1), location: 'School auditorium', notes: 'Costume fitting before rehearsal. Pickup at the side entrance.' }),
      event('soccer', 1, 'Saturday soccer', 5, 10, 90, 'activity', { participantIds: participants.slice(1), location: 'Riverside Park · Field 3' }),
      event('conference', 1, 'Parent teacher meeting', 11, 15, 45, 'school', { participantIds: participants.slice(0, 2), location: 'Room 12 · Riverside School' }),
      event('break', 1, 'School break', 32, 9, 60, 'school', { participantIds: participants, time: { kind: 'allDay', startDate: addDays(today, 32), endDate: addDays(today, 37) }, location: null }),
      event('birthday', 0, 'Jamie’s birthday picnic', 40, 12, 120, 'social', { participantIds: participants, location: 'Lake Park' }),
    ];
  } else {
    events = [event('music', 0, 'Sam · Piano lesson', 3, 17, 45, 'activity', { participantIds: ['demo-casey'], location: 'Music Studio · 16 Pine Street' }), event('game', 0, 'Sam · Weekend game', 9, 11, 90, 'activity', { participantIds: ['demo-casey'], location: 'Riverside Park' })];
  }
  return { sources, events };
}

export class DemoCalendarProvider implements CalendarProvider {
  async sync(account: ExternalAccount, now: Date, signal: AbortSignal): Promise<ProviderSnapshot> {
    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) { reject(providerUnavailable()); return; }
      const abort = () => { clearTimeout(timer); reject(providerUnavailable()); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 20);
      signal.addEventListener('abort', abort, { once: true });
    });
    return demoProviderSnapshot(account, now);
  }
}
