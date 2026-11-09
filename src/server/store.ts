import { z } from 'zod';
import { calendarEventSchema, calendarSourceSchema, type CalendarEvent, type CalendarSource, type DemoProfile, type ExternalAccount, type Household, type HouseholdSnapshot, type Membership, type Permissions, type Role, type SessionResponse, type User } from '../shared/contracts.js';
import { ApiFailure, forbidden, notFound, providerUnavailable } from './errors.js';
import { DemoCalendarProvider, demoProviderSnapshot, localDate, profiles, type CalendarProvider, type Clock, type ProviderSnapshot } from './provider.js';

export const LIMITS = { accounts: 8, sources: 32, events: 1000 } as const;
const providerSchema = z.object({ sources: z.array(calendarSourceSchema.strict()).max(LIMITS.sources), events: z.array(calendarEventSchema.strict()).max(LIMITS.events) }).strict();
export function permissions(role: Role): Permissions {
  return { canView: true, canSelectSources: role !== 'viewer', canConnectAccounts: role !== 'viewer', canInvite: role === 'owner', canAdminister: role === 'owner' };
}
export interface StoreOptions { clock?: Clock; provider?: CalendarProvider }

/** One-process, ephemeral repository. All commits below are synchronous after validation. */
export class CalendarStore {
  readonly clock: Clock;
  private readonly provider: CalendarProvider;
  private readonly users: User[] = [
    { id: 'demo-alex', name: 'Alex Rivera' }, { id: 'demo-jamie', name: 'Jamie Rivera' },
    { id: 'demo-casey', name: 'Casey Rivera' }, { id: 'demo-outsider', name: 'Morgan Garden' },
  ];
  private readonly households: Household[] = [
    { id: 'household-rivera', name: 'Rivera family', timeZone: 'America/Los_Angeles' },
    { id: 'household-garden', name: 'Garden family', timeZone: 'America/Los_Angeles' },
  ];
  private readonly memberships: Membership[] = [
    { userId: 'demo-alex', householdId: 'household-rivera', role: 'owner' },
    { userId: 'demo-jamie', householdId: 'household-rivera', role: 'editor' },
    { userId: 'demo-casey', householdId: 'household-rivera', role: 'viewer' },
    { userId: 'demo-outsider', householdId: 'household-garden', role: 'owner' },
    { userId: 'demo-jamie', householdId: 'household-garden', role: 'viewer' },
  ];
  private readonly accounts = new Map<string, ExternalAccount>();
  private readonly sources = new Map<string, CalendarSource>();
  private readonly events = new Map<string, CalendarEvent>();
  private readonly connecting = new Set<string>();
  private readonly syncing = new Map<string, ExternalAccount>();

  constructor(options: StoreOptions = {}) {
    this.clock = options.clock ?? (() => new Date());
    this.provider = options.provider ?? new DemoCalendarProvider();
    const now = this.clock();
    for (const [householdId, profileId] of [['household-rivera', 'alex'], ['household-rivera', 'jamie'], ['household-garden', 'jamie']] as const) {
      const account = this.newAccount(householdId, profiles.find((profile) => profile.id === profileId)!, now);
      const data = this.validateProvider(account, demoProviderSnapshot(account, now));
      this.commit(account, data);
    }
  }
  authenticate(id: string | undefined): User {
    const user = this.users.find((entry) => entry.id === id);
    if (!user) throw new ApiFailure(401, 'UNAUTHENTICATED', 'A known demo identity is required');
    return { ...user };
  }
  membership(user: User, householdId: string): Membership {
    const membership = this.memberships.find((entry) => entry.userId === user.id && entry.householdId === householdId);
    if (!membership) throw notFound();
    return { ...membership };
  }
  session(user: User): SessionResponse {
    const memberships = this.memberships.filter((entry) => entry.userId === user.id);
    const households = this.households.filter((entry) => memberships.some((membership) => membership.householdId === entry.id));
    const now = this.clock();
    return structuredClone({ mode: 'demo', user, households, memberships, profiles: [...profiles], now: now.toISOString(), today: localDate(now, households[0]?.timeZone ?? 'UTC') });
  }
  snapshot(user: User, householdId: string): HouseholdSnapshot {
    const membership = this.membership(user, householdId);
    const household = this.households.find((entry) => entry.id === householdId)!;
    const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
    const accounts = [...this.accounts.values()].filter((entry) => entry.householdId === householdId).sort(byId);
    const sources = [...this.sources.values()].filter((entry) => entry.householdId === householdId).sort(byId);
    const visible = new Set(sources.filter((entry) => entry.selected).map((entry) => entry.id));
    const events = [...this.events.values()].filter((entry) => entry.householdId === householdId && visible.has(entry.sourceId)).sort((a, b) => {
      const dateA = a.time.kind === 'timed' ? a.time.start : a.time.startDate;
      const dateB = b.time.kind === 'timed' ? b.time.start : b.time.startDate;
      return dateA.localeCompare(dateB) || byId(a, b);
    });
    const members = this.users.filter((entry) => this.memberships.some((member) => member.householdId === householdId && member.userId === entry.id));
    const now = this.clock();
    return structuredClone({ household, membership, permissions: permissions(membership.role), members, accounts, sources, events, now: now.toISOString(), today: localDate(now, household.timeZone) });
  }
  private newAccount(householdId: string, profile: DemoProfile, now: Date): ExternalAccount {
    return { id: `${householdId}-${profile.id}`, householdId, ownerUserId: profile.ownerUserId, provider: 'google', profileId: profile.id, displayName: profile.name, email: profile.email, syncStatus: 'synced', lastSyncedAt: now.toISOString(), error: null };
  }
  private writable(user: User, householdId: string): Membership {
    const membership = this.membership(user, householdId);
    if (membership.role === 'viewer') throw forbidden();
    return membership;
  }
  private ownedAccount(user: User, householdId: string, accountId: string): ExternalAccount {
    const membership = this.writable(user, householdId);
    const account = this.accounts.get(accountId);
    if (!account || account.householdId !== householdId) throw notFound();
    if (membership.role !== 'owner' && account.ownerUserId !== user.id) throw forbidden();
    return account;
  }
  selectSource(user: User, householdId: string, sourceId: string, selected: boolean): CalendarSource {
    this.writable(user, householdId);
    const source = this.sources.get(sourceId);
    if (!source || source.householdId !== householdId) throw notFound();
    const updated = { ...source, selected };
    this.sources.set(sourceId, updated);
    return { ...updated };
  }
  async connect(user: User, householdId: string, profileId: DemoProfile['id'], signal: AbortSignal): Promise<ExternalAccount> {
    const membership = this.writable(user, householdId);
    const profile = profiles.find((entry) => entry.id === profileId)!;
    if (membership.role !== 'owner' && profile.ownerUserId !== user.id) throw forbidden();
    const account = this.newAccount(householdId, profile, this.clock());
    if (this.accounts.has(account.id) || this.connecting.has(account.id)) throw new ApiFailure(409, 'ACCOUNT_ALREADY_CONNECTED', 'This demo account is already connected');
    this.connecting.add(account.id);
    try {
      const data = await this.fetchProvider(account, signal);
      if (signal.aborted) throw providerUnavailable();
      this.checkCapacity(account, data);
      this.commit(account, data);
      return { ...account };
    } finally { this.connecting.delete(account.id); }
  }
  async sync(user: User, householdId: string, accountId: string, simulateFailure: boolean, signal: AbortSignal): Promise<ExternalAccount> {
    const account = this.ownedAccount(user, householdId, accountId);
    if (this.syncing.get(account.id) === account) throw new ApiFailure(409, 'SYNC_IN_PROGRESS', 'This account is already syncing', true);
    this.syncing.set(account.id, account);
    try {
      if (simulateFailure) throw providerUnavailable();
      const data = await this.fetchProvider(account, signal);
      // Object identity distinguishes a reconnected account with the same stable wire ID.
      if (this.accounts.get(account.id) !== account) throw notFound();
      if (signal.aborted) throw providerUnavailable();
      this.checkCapacity(account, data);
      const updated: ExternalAccount = { ...account, syncStatus: 'synced', error: null, lastSyncedAt: this.clock().toISOString() };
      this.commit(updated, data);
      return { ...updated };
    } catch (error) {
      if (this.accounts.get(account.id) !== account) throw notFound();
      this.accounts.set(account.id, { ...account, syncStatus: 'error', error: 'The simulated provider is unavailable. Try syncing again.' });
      throw error;
    } finally { if (this.syncing.get(account.id) === account) this.syncing.delete(account.id); }
  }
  disconnect(user: User, householdId: string, accountId: string): void {
    const membership = this.writable(user, householdId);
    const account = this.accounts.get(accountId);
    if (account && account.householdId !== householdId) throw notFound();
    if (!account) { if (membership.role === 'owner') return; throw notFound(); }
    if (membership.role !== 'owner' && account.ownerUserId !== user.id) throw forbidden();
    const sourceIds = new Set([...this.sources.values()].filter((entry) => entry.accountId === accountId).map((entry) => entry.id));
    this.accounts.delete(accountId);
    for (const id of sourceIds) this.sources.delete(id);
    for (const [id, event] of this.events) if (sourceIds.has(event.sourceId)) this.events.delete(id);
  }
  private async fetchProvider(account: ExternalAccount, signal: AbortSignal): Promise<ProviderSnapshot> {
    let abort: (() => void) | undefined;
    try {
      if (signal.aborted) throw providerUnavailable();
      const aborted = new Promise<never>((_resolve, reject) => {
        abort = () => reject(providerUnavailable());
        signal.addEventListener('abort', abort, { once: true });
      });
      const raw = await Promise.race([this.provider.sync({ ...account }, this.clock(), signal), aborted]);
      return this.validateProvider(account, raw);
    } catch { throw providerUnavailable(); }
    finally { if (abort) signal.removeEventListener('abort', abort); }
  }
  private validateProvider(account: ExternalAccount, raw: unknown): ProviderSnapshot {
    const parsed = providerSchema.parse(raw);
    const sourceIds = new Set<string>();
    const memberIds = new Set(this.memberships.filter((entry) => entry.householdId === account.householdId).map((entry) => entry.userId));
    for (const source of parsed.sources) {
      if (source.householdId !== account.householdId || source.accountId !== account.id || sourceIds.has(source.id)) throw providerUnavailable();
      const existing = this.sources.get(source.id);
      if (existing && existing.accountId !== account.id) throw providerUnavailable();
      sourceIds.add(source.id);
    }
    const ids = new Set<string>();
    const eventKeys = new Set<string>();
    const events: CalendarEvent[] = [];
    for (const event of parsed.events) {
      if (event.householdId !== account.householdId || !sourceIds.has(event.sourceId) || event.participantIds.some((id) => !memberIds.has(id))) throw providerUnavailable();
      const existing = this.events.get(event.id);
      if (existing && (existing.sourceId !== event.sourceId || existing.providerEventId !== event.providerEventId)) throw providerUnavailable();
      const key = `${event.sourceId}:${event.providerEventId}`;
      if (eventKeys.has(key)) continue; // Provider duplicate delivery is idempotent within a source.
      if (ids.has(event.id)) throw providerUnavailable();
      const previous = [...this.events.values()].find((entry) => entry.sourceId === event.sourceId && entry.providerEventId === event.providerEventId);
      events.push(previous ? { ...event, id: previous.id } : event);
      ids.add(event.id);
      eventKeys.add(key);
    }
    return { sources: parsed.sources, events };
  }
  private checkCapacity(account: ExternalAccount, data: ProviderSnapshot): void {
    const accounts = [...this.accounts.values()].filter((entry) => entry.householdId === account.householdId && entry.id !== account.id);
    const otherSources = [...this.sources.values()].filter((entry) => entry.householdId === account.householdId && entry.accountId !== account.id);
    const otherSourceIds = new Set(otherSources.map((entry) => entry.id));
    const otherEvents = [...this.events.values()].filter((entry) => otherSourceIds.has(entry.sourceId));
    if (accounts.length + 1 > LIMITS.accounts || otherSources.length + data.sources.length > LIMITS.sources || otherEvents.length + data.events.length > LIMITS.events) {
      throw new ApiFailure(409, 'CAPACITY_EXCEEDED', 'The demo household capacity has been reached');
    }
  }
  private commit(account: ExternalAccount, data: ProviderSnapshot): void {
    const oldSources = [...this.sources.values()].filter((entry) => entry.accountId === account.id);
    const oldIds = new Set(oldSources.map((entry) => entry.id));
    const selections = new Map(oldSources.map((entry) => [entry.id, entry.selected]));
    for (const id of oldIds) this.sources.delete(id);
    for (const [id, event] of this.events) if (oldIds.has(event.sourceId)) this.events.delete(id);
    this.accounts.set(account.id, account);
    for (const source of data.sources) this.sources.set(source.id, { ...source, selected: selections.get(source.id) ?? source.selected });
    for (const event of data.events) this.events.set(event.id, event);
  }
}
