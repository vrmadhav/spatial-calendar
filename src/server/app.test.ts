import { afterEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { householdSnapshotSchema, sessionResponseSchema, type CalendarEvent, type ExternalAccount } from '../shared/contracts.js';
import { createServer } from './app.js';
import { CalendarStore } from './store.js';
import { demoProviderSnapshot, localDate, type CalendarProvider, type ProviderSnapshot } from './provider.js';

const NOW = new Date('2026-10-23T19:00:00.000Z');
const ROOT = '/api/v1/households/household-rivera';
const ALEX = 'household-rivera-alex';
const JAMIE = 'household-rivera-jamie';
const servers: Server[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); }))); });
async function harness(provider?: CalendarProvider, deadlineMs?: number) {
  const store = new CalendarStore({ clock: () => NOW, provider });
  const server = createServer({ store, deadlineMs });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); }); });
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No TCP address');
  const base = `http://127.0.0.1:${address.port}`;
  const request = (path: string, method = 'GET', body?: unknown, user: string | null = 'demo-alex', headers: Record<string, string> = {}) => fetch(`${base}${path}`, {
    method, headers: { ...(user ? { 'X-Demo-User': user } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const snapshot = async (user = 'demo-alex', household = ROOT) => {
    const response = await request(`${household}/snapshot`, 'GET', undefined, user);
    expect(response.status).toBe(200);
    return householdSnapshotSchema.parse(await response.json());
  };
  return { store, base, request, snapshot };
}
async function error(response: Response, status: number, code: string, retryable = false) {
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ error: { code, message: expect.any(String), retryable } });
  expect(response.headers.get('cache-control')).toBe('no-store');
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('HTTP v1 bootstrap, authorization and isolation', () => {
  it('exposes safe health, scoped session and fully validated multi-account snapshot', async () => {
    const api = await harness();
    const health = await api.request('/api/v1/health', 'GET', undefined, null);
    expect(await health.json()).toEqual({ status: 'ok', mode: 'demo' });
    const session = sessionResponseSchema.parse(await (await api.request('/api/v1/session')).json());
    expect(session.households.map((entry) => entry.id)).toEqual(['household-rivera']);
    expect(session.memberships).toEqual([{ userId: 'demo-alex', householdId: 'household-rivera', role: 'owner' }]);
    expect(session.today).toBe('2026-10-23');
    expect(session.profiles).toHaveLength(3);
    const snapshot = await api.snapshot();
    expect(snapshot.accounts).toHaveLength(2);
    expect(snapshot.sources).toHaveLength(4);
    expect(snapshot.events.length).toBeGreaterThanOrEqual(10);
    expect(snapshot.events.some((event) => event.travel?.kind === 'flight')).toBe(true);
    expect(snapshot.events.some((event) => event.time.kind === 'allDay')).toBe(true);
    expect(snapshot.events.every((event) => event.householdId === 'household-rivera')).toBe(true);
    expect(JSON.stringify(snapshot)).not.toMatch(/token|secret|password/i);
  });
  it.each([null, 'unknown-user'])('rejects absent or unknown demo identity (%s)', async (user) => {
    const api = await harness();
    await error(await api.request('/api/v1/session', 'GET', undefined, user), 401, 'UNAUTHENTICATED');
  });
  it('hides households and foreign child resources before disclosing records', async () => {
    const api = await harness();
    await error(await api.request(`${ROOT}/snapshot`, 'GET', undefined, 'demo-outsider'), 404, 'NOT_FOUND');
    await error(await api.request(`${ROOT}/accounts`, 'POST', { profileId: 'sam' }, 'demo-outsider'), 404, 'NOT_FOUND');
    const garden = await api.snapshot('demo-outsider', '/api/v1/households/household-garden');
    expect(garden.accounts).toHaveLength(1);
    const foreignAccount = garden.accounts[0].id;
    const foreignSource = garden.sources[0].id;
    await error(await api.request(`${ROOT}/accounts/${foreignAccount}/sync`, 'POST', {}), 404, 'NOT_FOUND');
    await error(await api.request(`${ROOT}/accounts/${foreignAccount}`, 'DELETE'), 404, 'NOT_FOUND');
    await error(await api.request(`${ROOT}/sources/${foreignSource}`, 'PATCH', { selected: false }), 404, 'NOT_FOUND');
    expect(await api.snapshot('demo-outsider', '/api/v1/households/household-garden')).toEqual(garden);
  });
  it('enforces viewer denial and account-owning editor policy', async () => {
    const api = await harness();
    const before = await api.snapshot();
    for (const [path, method, body] of [
      [`${ROOT}/accounts`, 'POST', { profileId: 'sam' }],
      [`${ROOT}/accounts/${ALEX}/sync`, 'POST', {}],
      [`${ROOT}/accounts/${ALEX}`, 'DELETE', undefined],
      [`${ROOT}/accounts/missing`, 'DELETE', undefined],
      [`${ROOT}/sources/${before.sources[0].id}`, 'PATCH', { selected: false }],
    ] as const) await error(await api.request(path, method, body, 'demo-casey'), 403, 'FORBIDDEN');
    await error(await api.request(`${ROOT}/accounts`, 'POST', { profileId: 'sam' }, 'demo-jamie'), 403, 'FORBIDDEN');
    await error(await api.request(`${ROOT}/accounts/${ALEX}/sync`, 'POST', {}, 'demo-jamie'), 403, 'FORBIDDEN');
    await error(await api.request(`${ROOT}/accounts/${ALEX}`, 'DELETE', undefined, 'demo-jamie'), 403, 'FORBIDDEN');
    expect(await api.snapshot()).toEqual(before);
    expect((await api.request(`${ROOT}/accounts/${JAMIE}/sync`, 'POST', {}, 'demo-jamie')).status).toBe(200);
    expect((await api.request(`${ROOT}/accounts/${JAMIE}`, 'DELETE', undefined, 'demo-jamie')).status).toBe(204);
    await error(await api.request(`${ROOT}/accounts/${JAMIE}`, 'DELETE', undefined, 'demo-jamie'), 404, 'NOT_FOUND');
    expect((await api.request(`${ROOT}/accounts`, 'POST', { profileId: 'jamie' }, 'demo-jamie')).status).toBe(201);
    const viewer = await api.snapshot('demo-casey');
    expect(viewer.permissions).toEqual({ canView: true, canSelectSources: false, canConnectAccounts: false, canInvite: false, canAdminister: false });
  });
  it.each(['https://evil.example', 'null', 'http://localhost.evil.example', 'file://localhost', 'https://user@localhost'])('rejects non-local write origin %s', async (origin) => {
    const api = await harness();
    await error(await api.request(`${ROOT}/accounts`, 'POST', { profileId: 'sam' }, 'demo-alex', { Origin: origin }), 403, 'ORIGIN_FORBIDDEN');
    expect((await api.snapshot()).accounts).toHaveLength(2);
  });
  it.each(['http://localhost:5173', 'http://127.0.0.1:5173', 'https://[::1]:5173'])('accepts local origin %s without wildcard CORS', async (origin) => {
    const api = await harness();
    const response = await api.request(`${ROOT}/accounts`, 'POST', { profileId: 'sam' }, 'demo-alex', { Origin: origin });
    expect(response.status).toBe(201);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('validation and HTTP errors', () => {
  it.each([{ profileId: 'sam', token: 'never-accepted' }, { profileId: 'invalid' }, { profileId: 4 }, null, [], {}])('rejects invalid connect body %j before mutation', async (body) => {
    const api = await harness();
    const before = await api.snapshot();
    await error(await api.request(`${ROOT}/accounts`, 'POST', body), 400, 'INVALID_INPUT');
    expect(await api.snapshot()).toEqual(before);
  });
  it('rejects malformed JSON, oversized bodies, wrong media types, invalid IDs and unknown queries', async () => {
    const api = await harness();
    const before = await api.snapshot();
    const raw = (body: string, contentType = 'application/json') => fetch(`${api.base}${ROOT}/accounts`, { method: 'POST', headers: { 'X-Demo-User': 'demo-alex', 'Content-Type': contentType }, body });
    await error(await raw('{'), 400, 'INVALID_INPUT');
    await error(await raw(' '.repeat(16 * 1024 + 1)), 413, 'BODY_TOO_LARGE');
    await error(await raw('{}', 'text/plain'), 415, 'UNSUPPORTED_MEDIA_TYPE');
    await error(await api.request(`${ROOT}/accounts/bad%20id/sync`, 'POST', {}), 400, 'INVALID_INPUT');
    await error(await api.request('/api/v1/households/bad%20id/snapshot'), 400, 'INVALID_INPUT');
    await error(await api.request(`${ROOT}/snapshot?include=secrets`), 400, 'INVALID_INPUT');
    await error(await api.request('/api/v1/health?anything=yes'), 400, 'INVALID_INPUT');
    await error(await api.request(`${ROOT}/accounts/${ALEX}`, 'DELETE', {}), 400, 'INVALID_INPUT');
    await error(await api.request(`${ROOT}/sources/${before.sources[0].id}`, 'PATCH', { selected: 'yes' }), 400, 'INVALID_INPUT');
    await error(await api.request(`${ROOT}/accounts/${ALEX}/sync`, 'POST', { simulateFailure: 'yes' }), 400, 'INVALID_INPUT');
    await error(await api.request(`${ROOT}/accounts/${ALEX}/sync`, 'POST', { simulateFailure: false, extra: true }), 400, 'INVALID_INPUT');
    await error(await api.request(`${ROOT}/sources/${before.sources[0].id}`, 'PATCH', { selected: true, extra: true }), 400, 'INVALID_INPUT');
    expect(await api.snapshot()).toEqual(before);
  });
  it('returns stable route/method errors and remains usable', async () => {
    const api = await harness();
    await error(await api.request('/unknown'), 404, 'NOT_FOUND');
    const wrongMethod = await api.request('/api/v1/health', 'POST', {});
    expect(wrongMethod.headers.get('allow')).toBe('GET');
    await error(wrongMethod, 405, 'METHOD_NOT_ALLOWED');
    await error(await api.request(`${ROOT}/sources/missing`, 'PATCH', { selected: true }), 404, 'NOT_FOUND');
    await error(await api.request(`${ROOT}/accounts/missing/sync`, 'POST', {}), 404, 'NOT_FOUND');
    expect((await api.request('/api/v1/health')).status).toBe(200);
  });
});

describe('account and selection lifecycle', () => {
  it('connects, rejects duplicates, syncs idempotently, purges on disconnect, and reconnects', async () => {
    const api = await harness();
    const connected = await api.request(`${ROOT}/accounts`, 'POST', { profileId: 'sam' });
    expect(connected.status).toBe(201);
    const account = await connected.json() as ExternalAccount;
    const full = await api.snapshot();
    expect(full.accounts).toHaveLength(3);
    const sourceIds = full.sources.filter((entry) => entry.accountId === account.id).map((entry) => entry.id);
    expect(full.events.some((event) => sourceIds.includes(event.sourceId))).toBe(true);
    await error(await api.request(`${ROOT}/accounts`, 'POST', { profileId: 'sam' }), 409, 'ACCOUNT_ALREADY_CONNECTED');
    for (let attempt = 0; attempt < 2; attempt++) expect((await api.request(`${ROOT}/accounts/${account.id}/sync`, 'POST', {})).status).toBe(200);
    expect((await api.snapshot()).events).toEqual(full.events);
    const removed = await api.request(`${ROOT}/accounts/${account.id}`, 'DELETE');
    expect(removed.status).toBe(204);
    expect(await removed.text()).toBe('');
    const after = await api.snapshot();
    expect(after.sources.some((source) => source.accountId === account.id)).toBe(false);
    expect(after.events.some((event) => sourceIds.includes(event.sourceId))).toBe(false);
    expect((await api.request(`${ROOT}/accounts/${account.id}`, 'DELETE')).status).toBe(204);
    expect((await api.request(`${ROOT}/accounts`, 'POST', { profileId: 'sam' })).status).toBe(201);
    expect((await api.snapshot()).events).toEqual(full.events);
  });
  it('shares selection across users/reloads, preserves it through sync and resets on restart', async () => {
    const api = await harness();
    const before = await api.snapshot();
    const source = before.sources[0];
    for (let attempt = 0; attempt < 2; attempt++) expect((await api.request(`${ROOT}/sources/${source.id}`, 'PATCH', { selected: false }, 'demo-jamie')).status).toBe(200);
    const hidden = await api.snapshot('demo-casey');
    expect(hidden.sources.find((entry) => entry.id === source.id)?.selected).toBe(false);
    expect(hidden.events.every((event) => event.sourceId !== source.id)).toBe(true);
    expect((await api.request(`${ROOT}/accounts/${source.accountId}/sync`, 'POST', {})).status).toBe(200);
    expect((await api.snapshot()).sources.find((entry) => entry.id === source.id)?.selected).toBe(false);
    const restarted = await harness();
    expect((await restarted.snapshot()).events).toEqual(before.events);
    expect((await api.request(`${ROOT}/sources/${source.id}`, 'PATCH', { selected: true })).status).toBe(200);
    expect((await api.snapshot()).events).toEqual(before.events);
  });
  it('retains good events on failure and clears visible error on retry', async () => {
    const api = await harness();
    const before = await api.snapshot();
    await error(await api.request(`${ROOT}/accounts/${ALEX}/sync`, 'POST', { simulateFailure: true }), 502, 'PROVIDER_UNAVAILABLE', true);
    const failed = await api.snapshot();
    expect(failed.events).toEqual(before.events);
    const failedAccount = failed.accounts.find((entry) => entry.id === ALEX)!;
    expect(failedAccount.syncStatus).toBe('error');
    expect(failedAccount.error).toMatch(/unavailable/);
    expect(failedAccount.lastSyncedAt).toBe(before.accounts.find((entry) => entry.id === ALEX)!.lastSyncedAt);
    expect((await api.request(`${ROOT}/accounts/${ALEX}/sync`, 'POST', {})).status).toBe(200);
    expect((await api.snapshot()).accounts.find((entry) => entry.id === ALEX)).toMatchObject({ syncStatus: 'synced', error: null });
  });
});

describe('provider validation, capacity, cancellation and races', () => {
  it.each(['invalid-event', 'foreign-source', 'foreign-participant', 'duplicate-source', 'throws'] as const)('rejects %s provider output atomically with safe errors', async (failure) => {
    const api = await harness({ sync: async (account, now) => {
      if (failure === 'throws') throw new Error('PRIVATE-TOKEN provider stack');
      const data = demoProviderSnapshot(account, now);
      if (failure === 'invalid-event') data.events[0].time = { kind: 'allDay', startDate: '2026-02-30', endDate: '2026-03-02' };
      if (failure === 'foreign-source') data.sources[0].householdId = 'household-garden';
      if (failure === 'foreign-participant') data.events[0].participantIds = ['demo-outsider'];
      if (failure === 'duplicate-source') data.sources.push(data.sources[0]);
      return data;
    } });
    const before = await api.snapshot();
    const response = await api.request(`${ROOT}/accounts/${ALEX}/sync`, 'POST', {});
    await error(response, 502, 'PROVIDER_UNAVAILABLE', true);
    const after = await api.snapshot();
    expect(after.events).toEqual(before.events);
    expect(after.sources).toEqual(before.sources);
    expect(after.accounts.find((entry) => entry.id === ALEX)?.error).not.toMatch(/PRIVATE|TOKEN|stack/);
  });
  it('deduplicates provider keys, preserves existing IDs, and removes stale events', async () => {
    const api = await harness({ sync: async (account, now) => {
      const data = demoProviderSnapshot(account, now);
      data.events = [{ ...data.events[0], id: 'provider-changed-id' }, { ...data.events[0], id: 'duplicate-delivery-id' }];
      return data;
    } });
    const before = await api.snapshot();
    const first = before.events.find((event) => event.sourceId === `${ALEX}-personal`)!;
    expect((await api.request(`${ROOT}/accounts/${ALEX}/sync`, 'POST', {})).status).toBe(200);
    const after = await api.snapshot();
    const events = after.events.filter((event) => event.sourceId.startsWith(ALEX));
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe(first.id);
    expect(after.events.filter((event) => event.sourceId.startsWith(JAMIE))).toEqual(before.events.filter((event) => event.sourceId.startsWith(JAMIE)));
  });
  it.each(['events', 'sources'] as const)('enforces aggregate household %s capacity without partial commit', async (kind) => {
    const api = await harness({ sync: async (account, now) => {
      const data = demoProviderSnapshot(account, now);
      if (kind === 'events') data.events = Array.from({ length: 1000 }, (_, i): CalendarEvent => ({ ...data.events[0], id: `event-${i}`, providerEventId: `provider-${i}` }));
      else data.sources = Array.from({ length: 32 }, (_, i) => ({ ...data.sources[0], id: i === 0 ? data.sources[0].id : `source-${i}` }));
      if (kind === 'sources') data.events = [];
      return data;
    } });
    const before = await api.snapshot();
    await error(await api.request(`${ROOT}/accounts/${ALEX}/sync`, 'POST', {}), 409, 'CAPACITY_EXCEEDED');
    expect((await api.snapshot()).events).toEqual(before.events);
    expect((await api.snapshot()).sources).toEqual(before.sources);
  });
  it('times out an uncooperative provider and prevents late mutation', async () => {
    const gate = deferred<ProviderSnapshot>();
    const api = await harness({ sync: () => gate.promise }, 35);
    const before = await api.snapshot();
    await error(await api.request(`${ROOT}/accounts/${ALEX}/sync`, 'POST', {}), 502, 'PROVIDER_UNAVAILABLE', true);
    expect((await api.snapshot()).events).toEqual(before.events);
    gate.resolve({ sources: [], events: [] });
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    expect((await api.snapshot()).events).toEqual(before.events);
    expect((await api.snapshot()).accounts.find((entry) => entry.id === ALEX)?.syncStatus).toBe('error');
  });
  it('rejects duplicate in-flight sync and preserves selection changed during sync', async () => {
    const gate = deferred<ProviderSnapshot>();
    const started = deferred<ExternalAccount>();
    const api = await harness({ sync: (account) => { started.resolve(account); return gate.promise; } });
    const pending = api.request(`${ROOT}/accounts/${ALEX}/sync`, 'POST', {});
    const account = await started.promise;
    await error(await api.request(`${ROOT}/accounts/${ALEX}/sync`, 'POST', {}), 409, 'SYNC_IN_PROGRESS', true);
    expect((await api.request(`${ROOT}/sources/${ALEX}-personal`, 'PATCH', { selected: false })).status).toBe(200);
    gate.resolve(demoProviderSnapshot(account, NOW));
    expect((await pending).status).toBe(200);
    const snapshot = await api.snapshot();
    expect(snapshot.sources.find((entry) => entry.id === `${ALEX}-personal`)?.selected).toBe(false);
    expect(snapshot.events.every((event) => event.sourceId !== `${ALEX}-personal`)).toBe(true);
  });
  it.each([false, true])('cannot resurrect a disconnected account (reconnect=%s)', async (reconnect) => {
    const gate = deferred<ProviderSnapshot>();
    const started = deferred<ExternalAccount>();
    let calls = 0;
    const api = await harness({ sync: async (account, now) => { calls++; if (calls === 1) { started.resolve(account); return gate.promise; } return demoProviderSnapshot(account, now); } });
    const pending = api.request(`${ROOT}/accounts/${ALEX}/sync`, 'POST', {});
    const oldAccount = await started.promise;
    expect((await api.request(`${ROOT}/accounts/${ALEX}`, 'DELETE')).status).toBe(204);
    if (reconnect) expect((await api.request(`${ROOT}/accounts`, 'POST', { profileId: 'alex' })).status).toBe(201);
    const afterDisconnect = await api.snapshot();
    gate.resolve(demoProviderSnapshot(oldAccount, NOW));
    await error(await pending, 404, 'NOT_FOUND');
    expect(await api.snapshot()).toEqual(afterDisconnect);
  });
  it('serializes duplicate connects and releases a failed connection without partial state', async () => {
    const gate = deferred<ProviderSnapshot>();
    const started = deferred<ExternalAccount>();
    const api = await harness({ sync: (account) => { started.resolve(account); return gate.promise; } });
    const pending = api.request(`${ROOT}/accounts`, 'POST', { profileId: 'sam' });
    const account = await started.promise;
    await error(await api.request(`${ROOT}/accounts`, 'POST', { profileId: 'sam' }), 409, 'ACCOUNT_ALREADY_CONNECTED');
    gate.resolve(demoProviderSnapshot(account, NOW));
    expect((await pending).status).toBe(201);
    expect((await api.snapshot()).accounts).toHaveLength(3);
    const failing = await harness({ sync: async () => { throw new Error('provider unavailable'); } });
    for (let attempt = 0; attempt < 2; attempt++) await error(await failing.request(`${ROOT}/accounts`, 'POST', { profileId: 'sam' }), 502, 'PROVIDER_UNAVAILABLE', true);
    expect((await failing.snapshot()).accounts).toHaveLength(2);
  });
  it('seeds civil dates in the household timezone across midnight and DST', () => {
    expect(localDate(new Date('2026-10-24T02:00:00.000Z'))).toBe('2026-10-23');
    expect(localDate(new Date('2026-03-08T07:59:00.000Z'))).toBe('2026-03-07');
    const store = new CalendarStore({ clock: () => new Date('2026-03-06T20:00:00.000Z') });
    const snapshot = store.snapshot(store.authenticate('demo-alex'), 'household-rivera');
    const dentist = snapshot.events.find((event) => event.providerEventId === 'dentist')!;
    expect(dentist.time).toEqual({ kind: 'timed', start: '2026-03-08T23:00:00.000Z', end: '2026-03-09T00:00:00.000Z' });
    const firstStore = new CalendarStore({ clock: () => NOW });
    const seed = firstStore.snapshot(firstStore.authenticate('demo-alex'), 'household-rivera');
    seed.events.splice(0);
    expect(firstStore.snapshot(firstStore.authenticate('demo-alex'), 'household-rivera').events.length).toBeGreaterThan(0);
  });
});
