# API contract: Spatial household calendar

Status: AGREED
Contract version/revision: HTTP v1 / r1 (2026-10-23)
Owner: Architect
Consumers / implementers: Frontend / Backend; shared types owned by Lead
Related requirements / ADRs: [requirements r1](product-requirements.md), [ADR-001 r1](architecture-decision.md)

## Scope and compatibility

Same-origin HTTP JSON under `/api/v1`. All operations except health require `X-Demo-User: demo-alex` (default UI identity). Other test identities: `demo-jamie` editor, `demo-casey` viewer, and `demo-outsider` with no membership in `household-rivera`. Household uses `America/Los_Angeles`. Identity is resolved from seeded users and membership server-side. Unknown/missing identity → 401; non-member household → 404; unauthorized member action → 403. No cookie, OAuth credential, bearer token or real email is accepted.

JSON responses use `Content-Type: application/json` and `Cache-Control: no-store`. DELETE 204 has no body. JSON requests use `Content-Type: application/json`; reject incorrect type with 415. Bodies over 16 KiB → 413. Malformed JSON, unknown body fields, wrong types, unknown query fields and invalid enums → 400. IDs are opaque URL-safe strings of 1–100 characters (`[A-Za-z0-9_-]+`). All routes validate IDs. Error responses are `{ "error": { "code": string, "message": string, "retryable": boolean } }`, never a stack trace. Unrecognized routes → 404 `NOT_FOUND`; unsupported methods → 405 `METHOD_NOT_ALLOWED`. Server errors → 500 `INTERNAL_ERROR` without private details.

HTTP v1 permits additive optional fields; consumers ignore unknown response fields. Breaking changes require agreement/new revision before coding or a new API version after release. No pagination: a household snapshot includes at most 1,000 events and 32 sources. No query parameters in r1. UI applies date-range filtering to the bounded snapshot. No public network deployment is covered.

## Canonical schemas

`src/shared/contracts.ts` exports the following names and exact wire shapes. This document is normative until that Lead-owned file is created. IDs and ISO/date strings remain strings; runtime validation is still required.

```ts
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
```

Non-null fields are required. `color` is a six-digit hex CSS color. Strings from the simulated provider are bounded: title/name 200, location 500, notes/details 4,000 and summary 500 characters; participant arrays have at most 20 unique member IDs. ISO instants use canonical `YYYY-MM-DDTHH:mm:ss.sssZ`; all-day dates are valid Gregorian `YYYY-MM-DD`. End is strictly after start and exclusive for both variants. Time objects contain only their variant's fields. Participant IDs refer to household members. All referenced accounts/sources/events belong to the same household. Events only include selected sources; metadata includes selected and unselected sources. Email addresses are synthetic `.example` addresses, never actual accounts.

Permission mapping: owner has all booleans true; editor has view/select/connect true and invite/administer false; viewer has view true and all others false. Account mutation also requires owner role or `account.ownerUserId === currentUser.id`. New connections by editors require matching profile owner. Profiles alex and sam belong to `demo-alex`; jamie belongs to `demo-jamie`. Owners may connect any profile. Initial accounts alex/jamie are connected; sam is available to connect.

## Operations

All household routes begin `/api/v1/households/:householdId`. Authorization happens before any child-resource disclosure. Unknown child IDs return 404 `NOT_FOUND`. Supplied non-local Origin on writes returns 403 `ORIGIN_FORBIDDEN`; absent Origin is allowed for CLI/tests. Local means http(s) with hostname localhost, 127.0.0.1 or [::1]. No wildcard CORS headers. Responses never contain credentials. The API has a 5-second operation deadline; failures are safe and retryable only when stated. UI has an 8-second timeout and does not retry writes automatically.

### GET /api/v1/health

Unauthenticated liveness; 200 `{ "status": "ok", "mode": "demo" }`. No side effects, private data or query parameters.

### GET /api/v1/session

Authenticated bootstrap; 200 `SessionResponse`. Only returns households/memberships of the current user. `profiles` is a fixed synthetic catalog, not external account discovery. `now` is actual server time; `today` is the first household's local date (UTC date if user has none). Household snapshot supplies its own local today. Read-only; repeated requests safe. AC-01, AC-08.

Example bootstrap (time shown for illustration; server uses current time):

```json
{"mode":"demo","user":{"id":"demo-alex","name":"Alex Rivera"},"households":[{"id":"household-rivera","name":"Rivera family","timeZone":"America/Los_Angeles"}],"memberships":[{"userId":"demo-alex","householdId":"household-rivera","role":"owner"}],"profiles":[{"id":"alex","name":"Alex Rivera","email":"alex@family.example","ownerUserId":"demo-alex"},{"id":"jamie","name":"Jamie Rivera","email":"jamie@family.example","ownerUserId":"demo-jamie"},{"id":"sam","name":"Sam Rivera","email":"sam@family.example","ownerUserId":"demo-alex"}],"now":"2026-10-23T19:00:00.000Z","today":"2026-10-23"}
```

### GET /api/v1/households/:householdId/snapshot

Any household member; 200 `HouseholdSnapshot`. Includes all accounts/sources and selected-source events, plus member names. Events sort by date/instant then ID, accounts/sources by ID. No pagination or date query; bounded complete response makes source visibility and event state consistent. No side effects. AC-01, AC-02, AC-04, AC-05, AC-08.

### POST /api/v1/households/:householdId/accounts

Owner or editor matching profile owner. Body `ConnectAccountRequest`, e.g. `{"profileId":"sam"}`. No other fields. Atomically connects a synthetic account, creates selected sources and normalizes its events. 201 `ExternalAccount`. Frontend refetches snapshot after successful mutation. Existing household/profile pair → 409 `ACCOUNT_ALREADY_CONNECTED`; household limit exceeded → 409 `CAPACITY_EXCEEDED`; invalid profile → 400 `INVALID_INPUT`. Connection never accepts arbitrary provider credentials or callback URLs. No automatic retries; repeat connect is a conflict with no extra data. AC-06, AC-08, AC-09.

### PATCH /api/v1/households/:householdId/sources/:sourceId

Owner/editor, any source in their household. Body `SelectSourceRequest`, e.g. `{"selected":false}`; boolean required. 200 `CalendarSource`. Only shared selection changes; event records are retained but excluded from snapshots while unselected. Idempotent last accepted write wins. Unknown source → 404; viewer → 403 `FORBIDDEN`. AC-05, AC-08, AC-09.

### POST /api/v1/households/:householdId/accounts/:accountId/sync

Owner or account-owning editor. Body `SyncAccountRequest`, either `{}` or `{"simulateFailure":true}`. Success 200 `ExternalAccount` with `syncStatus: "synced"`, canonical lastSyncedAt and null error. Replaces the account's normalized event set atomically; stable event/source IDs and source selection persist. Same source/providerEventId upserts once. No paging or provider data exposed.

Simulated failure → 502 `PROVIDER_UNAVAILABLE`, retryable true; account becomes `syncStatus: "error"`, safe human-readable error and unchanged lastSyncedAt. Last good events remain unchanged. Frontend refreshes snapshot even after this error to show persisted status, while retaining existing UI data if the refresh itself fails. A subsequent `{}` retry succeeds. Duplicate in-flight sync → 409 `SYNC_IN_PROGRESS`, retryable true. If disconnected during sync, commit returns 404 and cannot recreate records. AC-06, AC-07, AC-09.

### DELETE /api/v1/households/:householdId/accounts/:accountId

Owner or account-owning editor. No body/query. 204, removing account, sources and events atomically. Repeating a formerly authorized delete in the same household is 204 for owner; a missing account also returns 204 for owner, 404 for editor because ownership is no longer provable. Viewer → 403 even when resource is missing. Deletes of another household are checked at household boundary and disclose nothing. No real provider revocation occurs. Frontend refetches snapshot; reconnect uses the profile catalog. AC-06, AC-08.

## Error examples and validation

| Case | Input | Output |
| --- | --- | --- |
| Invalid selection | `{"selected":"yes"}` | 400 `{"error":{"code":"INVALID_INPUT","message":"Invalid request body","retryable":false}}` |
| Missing/unknown identity | No X-Demo-User | 401 code `UNAUTHENTICATED`, retryable false |
| Outsider household | demo-outsider → Rivera snapshot | 404 code `NOT_FOUND`, retryable false |
| Viewer writes | demo-casey → source PATCH | 403 code `FORBIDDEN`, retryable false |
| Duplicate connect | Existing profile | 409 code `ACCOUNT_ALREADY_CONNECTED`, retryable false |
| Provider failure | simulateFailure true | 502 code `PROVIDER_UNAVAILABLE`, retryable true |
| Body limit | More than 16 KiB | 413 code `BODY_TOO_LARGE`, retryable false |
| Invalid media type | JSON route with text/plain | 415 code `UNSUPPORTED_MEDIA_TYPE`, retryable false |

Messages may be improved without contract changes; codes/statuses/shapes are stable. Body-free GET/DELETE do not require Content-Type. Request validation must finish before mutation. Snapshot metadata and events represent one consistent committed state. No per-event detail endpoint is necessary because details are already present in the bounded snapshot.

## Contract verification

- Schema source/ownership: this document and Lead-owned `src/shared/contracts.ts`. Lead reconciles divergence before implementation; runtime validators in backend protect all requests and normalized provider events.
- Producer tests: session scoping, all routes, exact successful shapes, denied roles/households, malformed/oversized/unknown input, duplicate connect, selection, disconnect cleanup, repeat sync deduplication, failure preservation and retry.
- Consumer tests: fixture typed to shared contract; source toggles, account management outcomes, error/refetch handling, full event details and provider-neutral time rendering.
- Compatibility checks: frontend and backend typecheck against one shared module; HTTP integration checks assert normative status/error behavior; QA runs an integrated real HTTP journey.

## Agreement and change control

| Role | Accepted revision | Acknowledgment / date |
| --- | --- | --- |
| Engineering Lead | HTTP v1/r1 | Explicit acceptance to Architect / 2026-10-23 |
| Architect | HTTP v1/r1 | Explicit acceptance to Lead / 2026-10-23 |
| Frontend / consumer | HTTP v1/r1 | Explicit acceptance reported by Lead / 2026-10-23 |
| Backend / producer | HTTP v1/r1 | Explicit acceptance reported by Lead / 2026-10-23 |

Lead confirmed all four acknowledgments; [implementation plan](implementation-plan.md) records the agreement evidence. Contract changes return to Architect and Lead, update revision/tests, and reopen agreement.
