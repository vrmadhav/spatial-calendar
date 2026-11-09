import { z } from 'zod';

export type Role = 'owner' | 'editor' | 'viewer';
export type Category = 'travel' | 'school' | 'activity' | 'health' | 'social';
export interface User { id: string; name: string }
export interface Household { id: string; name: string; timeZone: string }
export interface Membership { userId: string; householdId: string; role: Role }
export interface Permissions {
  canView: boolean; canSelectSources: boolean; canConnectAccounts: boolean;
  canInvite: boolean; canAdminister: boolean;
}
export interface DemoProfile { id: 'alex' | 'jamie' | 'sam'; name: string; email: string; ownerUserId: string }
export interface ExternalAccount {
  id: string; householdId: string; ownerUserId: string; provider: 'google';
  profileId: DemoProfile['id']; displayName: string; email: string;
  syncStatus: 'synced' | 'error'; lastSyncedAt: string | null; error: string | null;
}
export interface CalendarSource {
  id: string; householdId: string; accountId: string; name: string;
  color: string; selected: boolean;
}
export type EventTime =
  | { kind: 'timed'; start: string; end: string }
  | { kind: 'allDay'; startDate: string; endDate: string };
export interface TravelDetails {
  kind: 'flight' | 'hotel' | 'reservation'; summary: string;
  confirmationCode: string | null; details: string;
}
export interface CalendarEvent {
  id: string; householdId: string; sourceId: string; providerEventId: string;
  title: string; category: Category; time: EventTime; location: string | null;
  participantIds: string[]; notes: string; travel: TravelDetails | null;
}
export interface SessionResponse {
  mode: 'demo'; user: User; households: Household[]; memberships: Membership[];
  profiles: DemoProfile[]; now: string; today: string;
}
export interface HouseholdSnapshot {
  household: Household; membership: Membership; permissions: Permissions;
  members: User[]; accounts: ExternalAccount[]; sources: CalendarSource[];
  events: CalendarEvent[]; now: string; today: string;
}
export interface ConnectAccountRequest { profileId: DemoProfile['id'] }
export interface SelectSourceRequest { selected: boolean }
export interface SyncAccountRequest { simulateFailure?: boolean }
export interface ApiError { error: { code: string; message: string; retryable: boolean } }

export const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Invalid calendar date');
export const instantSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/).refine((value) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}, 'Expected canonical UTC instant');
export const userSchema = z.object({ id: idSchema, name: z.string().min(1).max(200) });
export const householdSchema = z.object({
  id: idSchema, name: z.string().min(1).max(200),
  timeZone: z.string().refine((value) => {
    try { new Intl.DateTimeFormat('en-US', { timeZone: value }); return true; }
    catch { return false; }
  }),
});
export const membershipSchema = z.object({ userId: idSchema, householdId: idSchema, role: z.enum(['owner', 'editor', 'viewer']) });
export const permissionsSchema = z.object({ canView: z.boolean(), canSelectSources: z.boolean(), canConnectAccounts: z.boolean(), canInvite: z.boolean(), canAdminister: z.boolean() });
export const demoProfileSchema = z.object({ id: z.enum(['alex', 'jamie', 'sam']), name: z.string().min(1).max(200), email: z.string().email().max(254), ownerUserId: idSchema });
export const externalAccountSchema = z.object({
  id: idSchema, householdId: idSchema, ownerUserId: idSchema, provider: z.literal('google'),
  profileId: demoProfileSchema.shape.id, displayName: z.string().min(1).max(200), email: z.string().email().max(254),
  syncStatus: z.enum(['synced', 'error']), lastSyncedAt: instantSchema.nullable(), error: z.string().max(500).nullable(),
});
export const calendarSourceSchema = z.object({
  id: idSchema, householdId: idSchema, accountId: idSchema, name: z.string().min(1).max(200), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), selected: z.boolean(),
});
export const eventTimeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('timed'), start: instantSchema, end: instantSchema }).strict().refine((time) => time.end > time.start, 'End must follow start'),
  z.object({ kind: z.literal('allDay'), startDate: dateSchema, endDate: dateSchema }).strict().refine((time) => time.endDate > time.startDate, 'End must follow start'),
]);
export const travelDetailsSchema = z.object({ kind: z.enum(['flight', 'hotel', 'reservation']), summary: z.string().max(500), confirmationCode: z.string().max(200).nullable(), details: z.string().max(4000) });
export const calendarEventSchema = z.object({
  id: idSchema, householdId: idSchema, sourceId: idSchema, providerEventId: idSchema,
  title: z.string().min(1).max(200), category: z.enum(['travel', 'school', 'activity', 'health', 'social']),
  time: eventTimeSchema, location: z.string().max(500).nullable(),
  participantIds: z.array(idSchema).max(20).refine((ids) => new Set(ids).size === ids.length, 'Duplicate participants'),
  notes: z.string().max(4000), travel: travelDetailsSchema.nullable(),
});
export const sessionResponseSchema = z.object({ mode: z.literal('demo'), user: userSchema, households: z.array(householdSchema), memberships: z.array(membershipSchema), profiles: z.array(demoProfileSchema), now: instantSchema, today: dateSchema });
export const householdSnapshotSchema = z.object({ household: householdSchema, membership: membershipSchema, permissions: permissionsSchema, members: z.array(userSchema), accounts: z.array(externalAccountSchema).max(8), sources: z.array(calendarSourceSchema).max(32), events: z.array(calendarEventSchema).max(1000), now: instantSchema, today: dateSchema });
export const connectAccountRequestSchema = z.object({ profileId: demoProfileSchema.shape.id }).strict();
export const selectSourceRequestSchema = z.object({ selected: z.boolean() }).strict();
export const syncAccountRequestSchema = z.object({ simulateFailure: z.boolean().optional() }).strict();
export const apiErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string(), retryable: z.boolean() }) });
