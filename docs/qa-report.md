# QA report: Spatial Family Calendar V1

Verdict: READY
QA reviewer: independent squad agent `/root/qa`
Date: 2026-10-23 (America/Los_Angeles)
Reviewed snapshot: base Git `703590e9ded024cc02d4a168e86302764f1f89dd`, dirty source manifest `985a4da313aec24e2d8dfdae4f7c119c79ba66ee33409571dd9efca39b35402d`; `evidence/qa/source-sha256.txt`.
Requirements / architecture / contract: [requirements r1](product-requirements.md), [ADR-001 r1](architecture-decision.md), [HTTP v1/r1](api-contract.md).
Environment: macOS Darwin 25.5.0, Node v26.3.0, npm 11.16.0, Chromium via Playwright, synthetic local data; all commands below target `/Users/viggy/Documents/Github/spatial-calendar`.

## Independence and scope

- Implementation authors: Lead, Frontend, Backend; Architect authored accepted design documents.
- QA contribution: independent final code/contract inspection, required command execution, additional browser/schema/restart probes and reporting. No production code or implementation tests edited.
- Scope: local synthetic-data prototype, AC-01 through AC-12, contract/security/recovery boundaries. No deployment, real OAuth, real users, durable data, or production capacity validation.
- Verification ran after both integrated-ready handoffs. Initial findings were fixed by their implementation owners; QA independently retested the final state. Source integrity check found zero changed files among all 50 manifest entries after tests.

## Executed checks

All commands executed independently in the repository root. The QA runner is a QA-path copy of the Lead runner; implementer results were not used as test evidence. Socket/browser access ran with approved escalation. Check logs include exact command, cwd, snapshot and exit status. `evidence/qa/results.json` records runtime, platform, base revision, commands and statuses.

| Check | Exact command / procedure and cwd | Exit code | Status | Result summary | Evidence path |
| --- | --- | --- | --- | --- | --- |
| Lint | `npm run lint`, repository root | 0 | PASS | ESLint clean | evidence/qa/lint.log |
| Type check | `npm run typecheck`, repository root | 0 | PASS | Strict TypeScript clean | evidence/qa/typecheck.log |
| Unit/integration | `npm test`, repository root | 0 | PASS | 61 tests: 38 server, 18 client, 5 shared | evidence/qa/test.log |
| Build | `npm run build`, repository root | 0 | PASS | Server and Vite bundles built | evidence/qa/build.log |
| Browser E2E | `npm run test:e2e`, repository root | 0 | PASS | 10 journeys, 375px and 1440px | evidence/qa/e2e.log |
| Restart recovery | `node evidence/qa/restart-check.mjs`, repository root | 0 | PASS | Isolated built API on port 3002; 12 → 9 filtered → 12 restored events | evidence/qa/restart.log; restart-server.log |
| Touch/geometry | `node evidence/qa/browser-check.mjs`, repository root | 0 | PASS | Gestures, actual viewport anchoring and page overflow checks at both widths | evidence/qa/browser-results.json; browser-check.log |
| Broad text contrast | `node evidence/qa/contrast-audit.mjs`, repository root | 0 | PASS | 684 text samples across overview/accounts/travel dialog and both widths (includes repeated background content); no below-target samples; minimum 4.856:1 | evidence/qa/contrast-audit.json; contrast-audit.log |
| Extended ISO boundary | `node evidence/qa/schema-check.mjs`, repository root | 0 | PASS | Extended years, invalid dates, missing milliseconds and offset variants rejected; valid canonical interval accepted | evidence/qa/schema-check.log |
| Source integrity | SHA-256 rehash of every path in final manifest | 0 | PASS | All 50 file hashes unchanged after verification | evidence/qa/final-integrity.log; git-status.txt |

Evidence paths are repository-relative. Additional command/environment/exit metadata is in `evidence/qa/supplemental-results.json`. Initial observations and prior source manifest are retained under `evidence/qa/initial/`, including the two failed probes; they are superseded by the independently executed final checks above.

## Acceptance traceability

| AC ID | Test / reproduction | Actual result | Status | Evidence |
| --- | --- | --- | --- | --- |
| AC-01 | Fresh seed HTTP fixture and 375/1440 browser overview | Two accounts/four sources and exact three-month boundaries | PASS | evidence/qa/test.log, evidence/qa/e2e.log |
| AC-02 | Earlier/later/Today browser journey; civil distance and DST tests | Chronological navigation, Today restoration, exact calendar-day distance | PASS | evidence/qa/test.log, evidence/qa/e2e.log |
| AC-03 | Month → week → day → month, slider, actual viewport geometry and touch pan | Preset error 0px; slider <0.000000001px at both widths | PASS | evidence/qa/browser-results.json, evidence/qa/e2e.log |
| AC-04 | Travel/activity details, timezone, source/account; Escape and return focus | Details and keyboard journey passed | PASS | evidence/qa/test.log, evidence/qa/e2e.log |
| AC-05 | Source toggle, visibility, restore and reload | Server-confirmed choice shared and persisted on reload | PASS | evidence/qa/test.log, evidence/qa/e2e.log |
| AC-06 | Connect Sam, repeat sync, disconnect purge, reconnect | Idempotent records and complete purge verified | PASS | evidence/qa/test.log, evidence/qa/e2e.log |
| AC-07 | Failed sync then retry | Last good events retained; busy ends; error clears on retry | PASS | evidence/qa/test.log, evidence/qa/e2e.log |
| AC-08 | Missing/unknown identity, outsider, viewer, editor and foreign child probes | 401/404/403 and unchanged denied-write state verified | PASS | evidence/qa/test.log |
| AC-09 | Malformed/unknown/wrong-type/oversized request/query/ID; provider schemas | All request cases pass; extended-year provider instant gap corrected and retested | PASS | evidence/qa/test.log, evidence/qa/schema-check.log |
| AC-10 | Strict timed overlap/shared participants, adjacent ends, all-day dates | Conflict labels and lanes distinguish simultaneous events; exclusive ends tested | PASS | evidence/qa/test.log, evidence/qa/e2e.log, evidence/qa/overview-1440.png |
| AC-11 | 375/1440 layout, keyboard focus trap/restore, states, readable controls | Layout, gestures, focus and states pass; corrected text contrast verified | PASS | evidence/qa/contrast-audit.json, evidence/qa/browser-results.json, evidence/qa/e2e.log |
| AC-12 | Browser reload and actual isolated process restart | Selection survives reload; process restart restores selected seed and 12 event IDs; UI explains reset | PASS | evidence/qa/e2e.log, evidence/qa/restart.log |

## Findings

| ID | Severity | Location | Reproduction / expected vs actual | Impact | Owner | Status / retest evidence |
| --- | --- | --- | --- | --- | --- | --- |
| DEF-01 | Medium | src/client/styles.css: `.pan-hint`, `.distance-badge`, `.event-meta`, `.page-footer`, `.zone-label`, `.upcoming-copy small` | Open at 375/1440; measure computed foreground/background. Meaningful small text should remain readable (4.5:1 normal-text contrast target); actual 8–9px text ratios 2.42–3.46:1. | Instructions, date metadata, distances and ephemeral-data explanation hard to read, especially for low-vision users. | Frontend | FIXED / VERIFIED. Initial evidence retained in evidence/qa/initial/browser-results.json; final broad audit minimum 4.856:1, no failures, evidence/qa/contrast-audit.json. |
| DEF-02 | Medium | src/shared/contracts.ts: instantSchema | Parse `+010000-01-01T00:00:00.000Z` or `-000001-01-01T00:00:00.000Z`; expected rejection under four-digit-year canonical API contract, actual acceptance. | Provider boundary admits out-of-contract instants; lexical interval ordering and frontend date parsing do not support extended years reliably. | Lead | FIXED / VERIFIED. Initial acceptance in evidence/qa/initial/schema-probe.log; final rejection in evidence/qa/schema-check.log and shared regression test. |

## Verdict and limitations

- Blocking findings / missing acceptance evidence: none. DEF-01 and DEF-02 are independently verified fixed. All AC-01–AC-12 pass within the agreed local prototype scope.
- Tests inspect meaningful behavior: HTTP tests use real isolated listeners, verify denied mutations preserve state, provider failures preserve last good events, concurrent disconnect cannot resurrect data, provider cancellation prevents late commits, and aggregate capacity rejects partial mutation. Component tests cover pending confirmation, combined write/refetch failure, safe text rendering and timeout without blind write retries.
- Browser E2E verifies collapsed account details focus trapping after all profiles connect, Escape restore, exclusive all-day displayed end, shared selection reload and account failure/recovery lifecycle at both widths.
- Additional touch gestures advance the timeline at both widths. Rendered viewport center anchor error is zero for presets and below 0.000000001 CSS pixel for slider. Screenshots inspected manually; no page-control overflow observed.
- Real Google/Gmail, production identity/hosting, durable storage/migrations, real-device/browser matrix, full WCAG certification and usability study are outside the accepted local prototype scope. No durable migration applies because data is entirely ephemeral. CI is absent; remote CI was NOT RUN.
- Recommendation: **READY for the agreed local synthetic-data prototype** at the recorded final source manifest. No deployment performed or authorized. This is not a production-readiness claim.

READY is a QA recommendation, not authorization to deploy.
