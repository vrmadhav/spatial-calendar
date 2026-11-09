# Product requirements: Spatial Family Calendar V1

Status: AGREED
Owner: Engineering Lead / Architect
Revision/date: r1 / 2026-10-23

## Problem and intended outcome

Busy couples and families coordinate school, appointments, activities, social plans and travel across multiple calendars. Disconnected calendar views make the distance between commitments hard to understand. V1 validates a continuous map of time: a calm three-month overview, contextual week/day zoom and useful event details.

The intended usability outcome is that a family member can locate a trip, state how many days away it is, zoom to its departure and return to the overview without losing the date. A later moderated study targets at least 4 of 5 participants completing that journey within 60 seconds without assistance. This is a product success target, not a claim that a study has been run. Implementation acceptance is the observable behavior below.

## Users, scope, and journeys

- Users: a household owner coordinating shared sources; editor family members maintaining connections; viewer family members reading shared plans. Membership is separate from identity. The UI operates as a clearly labeled demo owner; restricted roles are exercised through API tests.
- In scope: responsive local prototype, three-month primary overview with neighboring context, horizontal time navigation, month/week/day zoom, today navigation, future distance labels, source selection, simulated Google account connect/disconnect, manual simulated sync and failure recovery, overlaps and rich event details.
- Non-goals: real Google OAuth or Gmail access, production identity, invitations UI, event creation/editing, real background jobs, durable persistence, hosting/deployment, year/season detail levels, a user research study. Travel enrichment is explicitly simulated data.
- Assumptions: all data is synthetic; local server on loopback; household time zone America/Los_Angeles; real current date drives today and seed events relative to today. Restart restores deterministic demo content relative to the current date. No external credentials are accepted.
- Constraints: maintain separate user, household, membership, external account, source, normalized event and permissions concepts. Calendar UI must consume provider-neutral models.

## Acceptance criteria

| ID | Scenario / given-when-then | Expected measurable result | Verification method |
| --- | --- | --- | --- |
| AC-01 | Open the seeded household | At least two distinct simulated Google accounts and independently selectable sources contribute events; initial view covers three calendar months around today | API fixture test and browser check |
| AC-02 | Navigate backward/forward and return Today | Adjacent periods remain chronological; Today returns current household date; future events expose exact calendar-day distance | Date/navigation unit tests and browser journey |
| AC-03 | Focus a date and change month → week → day → month | Focal date remains at the same normalized horizontal viewport position (math error < 1 CSS pixel); detail increases; keyboard buttons and a continuous zoom control are available | Pure transform tests and browser interaction |
| AC-04 | Open a travel or activity event | Dialog shows title, time or all-day dates, household time zone, location, participants, notes, category, source/account and any travel details; Escape closes and focus returns to trigger | Component tests and browser journey |
| AC-05 | Change source selection | Deselected-source events disappear after server confirmation; reselection restores them; selection is shared household state | API and component tests |
| AC-06 | Connect an available demo profile, sync, disconnect and reconnect | Account/source/event records appear; repeated sync does not duplicate records; disconnect purges account sources/events; reconnect works | API lifecycle tests and browser journey |
| AC-07 | Simulate provider failure, then retry sync | Last good events remain visible, status/error is readable, busy state ends, successful retry clears error | API failure test and component test |
| AC-08 | Attempt missing/unknown identity, outsider household access and viewer mutation | HTTP 401, 404 and 403 respectively; no unauthorized mutation or cross-household data disclosure | API integration tests |
| AC-09 | Send malformed JSON, unknown fields, invalid IDs/types or oversized bodies | Stable documented errors; process remains usable; invalid writes leave state unchanged | API integration tests |
| AC-10 | Inspect overlapping events and all-day events | Simultaneous timed commitments are distinguishable and show conflict indication; adjacent exclusive-end events are not conflicts; all-day events remain on their civil dates | Date/overlap tests and browser check |
| AC-11 | Use phone and desktop widths and keyboard only | Functional at 375px and 1440px; timeline may scroll horizontally but page controls do not overflow; labeled controls, visible focus, dialog focus containment and restore; loading, empty, error and success states | Component tests and browser viewport checks |
| AC-12 | Reload and restart | Reload reflects server-held selection; server restart restores documented demo seed; UI explains ephemeral simulation | Integration/recovery test or reproducible manual evidence |

## Quality requirements

| Area | Target / constraint | How verified |
| --- | --- | --- |
| Security and privacy | Synthetic data only; role/tenant checks enforced server-side; 16 KiB request-body limit; no token or credential fields; loopback serving and same-origin UI | API denied-access/input tests; source inspection |
| Accessibility and responsiveness | Semantic controls, keyboard navigation, no color-only meaning, reduced-motion support, 375px/1440px layouts | Component tests plus browser checks; no full WCAG certification claimed |
| Performance and scale | Demo maximum 8 connected accounts, 32 sources and 1,000 events per household; visible-event rendering is bounded by viewport; no production capacity claim | Limits tests and build/browser inspection |
| Reliability and recovery | Failed sync retains last successful snapshot; no blind mutation retries; successful sync is idempotent; restart reseeds | Failure/idempotency/restart evidence |
| Operations | Health endpoint and safe errors; no real external network dependency; lint/typecheck/test/build gates and independent QA | Lead records exact actual commands and QA evidence |

## Decisions, risks, and open questions

| Item | Owner | Resolution needed before | Status / evidence |
| --- | --- | --- | --- |
| Simulated accounts and in-memory persistence | Lead | Implementation | Allowed explicitly by brief; chosen to prioritize spatial validation |
| Demo identity is spoofable and unsuitable for network deployment | Architect | Production work | Explicit local-only boundary; real authentication remains future work |
| Real OAuth, Gmail consent, retention and encrypted credentials | Architect / Backend | Real-provider implementation | Deferred; V1 stores no secrets |
| Cross-source copies may represent the same meeting | Architect | Real sync | Preserve both with source provenance; V1 deduplicates within a source only |
| Spatial experience and usability target | Lead / QA | Product validation | Automated invariants plus browser evidence required; participant study remains future work |

## Agreement and references

- Requirements agreement: Lead, Architect, Frontend and Backend accepted r1 on 2026-10-23; acknowledgments are recorded in the Lead's implementation plan.
- Architecture records: [ADR-001](architecture-decision.md).
- API contracts: [HTTP v1/r1](api-contract.md).
- Implementation plan: [Lead-owned plan](implementation-plan.md).
