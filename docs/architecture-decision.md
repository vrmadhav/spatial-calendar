# ADR-001: Local spatial calendar with a provider-neutral household boundary

Status: ACCEPTED
Date/revision: 2026-10-23 / r1
Owner: Architect
Related requirements: [V1 requirements r1](product-requirements.md), AC-01–AC-12
Supersedes / superseded by: none

## Context and constraints

The inspected repository contains squad instructions/templates and the product brief, with no existing application. V1 emphasizes spatial navigation and explicitly allows simulated Google accounts. A server boundary is still necessary to validate membership, role enforcement and a replaceable provider model.

## Options considered

| Option | Benefits | Costs / risks | Why selected or rejected |
| --- | --- | --- | --- |
| React/TypeScript/Vite UI, Node HTTP API and in-memory repository | Small local setup, typed consumer boundary, real authorization tests, replaceable provider/store | Restart loses changes; identity only simulated | Selected for prototype scope |
| Client-only local storage | Fastest mock | Does not exercise trusted authorization or scoped server repository | Rejected for required multi-user architecture |
| Durable database and real OAuth/sync jobs now | Closer to production | Requires credential, consent, migration and operational decisions unrelated to initial spatial experiment | Deferred until validated need; no provider chosen |

## Decision

Use a responsive React/TypeScript UI and a Node HTTP backend, with a small normalized TypeScript contract shared by both. Use Vite for local development and static build; frontend requests relative `/api/v1` routes through a dev proxy. The local backend binds loopback. The Lead owns common tooling and shared contract types; frontend owns UI and frontend tests; backend owns server, repository, provider adapter and backend tests. No infrastructure provider is selected.

Use an explicit **Demo data** label and seeded identities. Production deployment is outside this decision and requires a new authentication and persistence decision.

## Boundaries and data model

- UI owns viewport, focus, zoom, expanded event and request state. It cannot authorize operations. It consumes normalized events only, never provider event objects. A complete bounded household snapshot is simpler than paging the small demo corpus.
- API authenticates the demo identity, resolves household membership, enforces action permissions, validates runtime input and shapes stable errors. It never trusts a body/header-provided role.
- Repository owns household-scoped memberships, connected accounts, source selection and normalized events. Every entity lookup is scoped by authorized household before child-resource resolution.
- Provider adapter owns synthetic profile discovery and normalization. An interface equivalent to `sync(account, now): Promise<NormalizedProviderEvent[]>` isolates provider-specific input. Its inputs/outputs are validated before repository mutation. Simulated delays/errors are bounded.
- `User(id, name)` is independent of `Household(id, name, timeZone)`. `Membership(userId, householdId, role)` has a unique pair and role `owner | editor | viewer`. Roles resolve to explicit permissions for viewing, source selection, account management, inviting and administration. Invite/admin concepts exist in the permission map, with no V1 endpoints.
- `ExternalAccount(id, householdId, ownerUserId, provider, profileId, displayName, email, syncStatus, lastSyncedAt, error)` belongs to one household. A provider profile can connect once per household. There are no real tokens or token placeholders in client responses.
- `CalendarSource(id, householdId, accountId, name, color, selected)` belongs to one account. Source selection is a shared household setting; owners/editors may alter it.
- `CalendarEvent(id, householdId, sourceId, providerEventId, title, category, time, location, participantIds, notes, travel)` is immutable to clients. Unique `(householdId, sourceId, providerEventId)` makes sync idempotent. IDs are stable across successful sync; cross-source copies remain distinct. Disconnect removes the account, its sources and events as one atomic operation.
- Canonical types and wire fields: [HTTP v1/r1](api-contract.md). Only the Lead writes `src/shared/contracts.ts`; no duplicate shared type definitions.

### Time, layout and overlap invariants

Timed events store UTC ISO instants with `Z`; all-day events store real Gregorian `YYYY-MM-DD` civil dates with an exclusive end. Household IANA time zone controls displayed dates and times, regardless of browser zone. The session supplies `today` computed in that zone and `now` as an instant. Fixtures are seeded relative to server today, with no fixed stale demo date.

The timeline uses a continuous **civil-day coordinate**: the ordinal of a household calendar date plus local clock minutes / 1440. All-day starts/ends use midnight civil coordinates directly. This provides equal-width date cells across DST; repeated local hours may occupy the same spatial position, with time-zone-aware event labels retaining accurate instants. Do not calculate calendar-day distance by subtracting UTC event milliseconds across DST. Unit-test date parsing, DST display dates and exclusive ends.

Map date coordinate `d` to `x = (d - origin) * scale`. On zoom from `s` to `s2` at pixel `p`, calculate `anchor = origin + p/s`, then `origin2 = anchor - p/s2`. Keyboard zoom anchors at viewport center; pointer/wheel zoom may anchor under pointer. A slider changes scale continuously; month/week/day buttons are presets of that same transform. Month overview spans the exact calendar months preceding, containing and following today; visible neighboring month context may fade. Today and navigation controls deliberately reposition the anchor. Clamp supported date navigation to today ± 2 years, and expose disabled controls at limits.

Timed conflicts require intersecting intervals with strict `startA < endB && startB < endA` and at least one shared participant. All-day events are background date commitments and excluded from timed conflict badges. Event lanes prevent visual occlusion; they may show concurrent events without shared participants in separate lanes without calling them conflicts.

### Trust, permissions and privacy

`X-Demo-User` identifies one seeded user. This is deliberately spoofable, not real authentication. Bind loopback, do not enable wildcard CORS, and reject a supplied non-local Origin on mutations. Missing/unknown identity → 401; known non-member → 404; member without permission → 403. Owners may connect/sync/disconnect any household account; editors may connect a profile they own and sync/disconnect only their own accounts; viewers only read. All write roles may change household source selection. Resource lookup for another household never reveals its existence. Serve only synthetic names/emails and event content, render text safely, and log no request bodies or event notes.

## Failure, scale, and operations

- Sync constructs and validates a replacement account event set before committing; any failure leaves last good events intact while updating the account's visible error state. Keep source IDs/selection stable. Successful sync replaces that account's complete event set and removes stale source events.
- API operations finish within 5 seconds or return a safe provider error; the frontend aborts requests after 8 seconds and offers retry. No automatic write retries. Successful sync, source selection and repeat DELETE are idempotent. Connect uniqueness conflict is 409.
- Limits: 16 KiB JSON bodies, 8 connected accounts, 32 sources and 1,000 events per household. This prototype is one process with memory state and a bounded synthetic dataset; no claims about production concurrency/throughput. UI filters to the visible date interval before rendering event elements.
- Concurrent mutations serialize synchronously at commit. Source selection is last accepted write wins. Sync and disconnect must recheck account existence at commit, so an in-flight sync cannot resurrect a disconnected account. Duplicate in-flight sync can be rejected with 409 `SYNC_IN_PROGRESS`.
- Health returns only status/mode. Errors have stable codes, safe messages and a retryable flag. No real provider payloads, stack traces, credentials or private notes are logged or returned as errors.
- Restart intentionally resets seed data. No durable migration/backups apply because no durable store exists. Future storage migration implements the repository interface and preserves entity invariants; production authentication replaces only the identity resolver. Real credentials belong in encrypted server-side storage, disconnected grants are revoked/removed, and background workers must enforce the same account lifecycle/tenant scope.
- Rollback is stopping the local process and restoring the reviewed source revision; no external resources or provider writes exist. Future wire breaks require `/api/v2` or an agreed r2 before implementation.

## Consequences and validation

- A complete bounded snapshot avoids pagination consistency complexity but must be revisited beyond 1,000 events. Equal-width civil days favor navigation over elapsed-hour geometry across DST. Simulated identity permits API permission testing but provides no protection from someone with local machine access.
- Verify all ACs through pure time/viewport tests, component behavior tests, HTTP integration tests and independent QA browser journeys. Required command evidence is owned by the Lead; no checks are reported passed here.
- Revisit on real-user data, real OAuth, remote access, event mutation, multiple server processes, durable recovery requirements or more than 1,000 household events.

## Agreement

| Role | Accepted revision | Acknowledgment / date | Outstanding blocker |
| --- | --- | --- | --- |
| Engineering Lead | r1 | Explicit acceptance to Architect / 2026-10-23 | None |
| Architect | r1 | Explicit acceptance to Lead / 2026-10-23 | None |
| Frontend | r1 | Explicit acceptance reported by Lead / 2026-10-23 | None |
| Backend | r1 | Explicit acceptance reported by Lead / 2026-10-23 | None |

Lead confirmed all four acknowledgments; [implementation plan](implementation-plan.md) records the agreement evidence. Implementation may proceed under its exclusive file assignments. Contract changes reopen this gate.
