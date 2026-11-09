# Release readiness: Spatial Family Calendar V1 prototype

Status: READY FOR USER REVIEW — local synthetic-data prototype only
Lead: main Codex session
Release revision/artifact: base `703590e9ded024cc02d4a168e86302764f1f89dd` plus source manifest [evidence/lead/source-sha256.txt](../evidence/lead/source-sha256.txt)
Final integrated snapshot: `985a4da313aec24e2d8dfdae4f7c119c79ba66ee33409571dd9efca39b35402d`
Target environment: local developer machine; synthetic-data prototype only
QA report: [Independent QA report](qa-report.md)

## Delivered scope

React/TypeScript family calendar with a continuous three-month overview, horizontal navigation, month/week/day presets, continuous zoom preserving the focal date, today and future-distance cues, conflicts, rich event/travel details, source selection, and simulated multi-account connect/sync/disconnect. Responsive layouts and keyboard dialogs are included.

The Node API uses separate identities, households, memberships, accounts, sources, events and permissions. It validates untrusted requests and provider output, enforces household and role boundaries, preserves last good data after provider failure, and guards duplicate/concurrent sync and disconnect races. Simulated provider and repository boundaries allow future replacement without coupling the calendar to Google payloads.

Users, product success target, measurable acceptance criteria, model, architecture and HTTP v1/r1 were recorded and accepted by Lead, Architect, Frontend and Backend before implementation. Actual agents implemented separate exclusive paths; a distinct QA agent performs independent verification.

## Evidence and gates

- [x] Requirements, architecture and contract revisions agreed and implemented.
- [x] Lead ran lint, strict typecheck, tests, build and browser journeys on the integrated snapshot.
- [x] CI absence explicitly recorded: no CI is configured; no remote checks claimed.
- [x] Independent QA completed with a READY recommendation.
- [x] No unresolved blocking defects or unverified acceptance criteria.
- [x] Local configuration, lack of credentials, ephemeral state and recovery documented.
- [x] Local rollout and rollback steps documented below; production scope excluded.

| Gate | Command / procedure | Outcome | Evidence | Limitations |
| --- | --- | --- | --- | --- |
| Lint | `npm run lint` | PASS, exit 0 | [log](../evidence/lead/lint.log) | Local run |
| Types | `npm run typecheck` | PASS, exit 0 | [log](../evidence/lead/typecheck.log) | Strict TypeScript |
| Unit/API/component | `npm test` | PASS, exit 0; 61 tests | [log](../evidence/lead/test.log) | Synthetic inputs/providers |
| Build | `npm run build` | PASS, exit 0 | [log](../evidence/lead/build.log) | Nonfatal upstream Zod comment annotation warnings |
| Browser journeys | `npm run test:e2e` | PASS, exit 0; 10 tests | [log](../evidence/lead/e2e.log) | Chromium at 1440px and 375px; no broad browser certification |
| Independent QA | Separate agent repeats all five gates, restart, gestures, geometry, schema and contrast probes | READY; all 12 acceptance criteria PASS | [QA report](qa-report.md), [metadata](../evidence/qa/results.json) | Local synthetic-data scope only |

All commands run in `/Users/viggy/Documents/Github/spatial-calendar` on macOS Darwin 25.5.0, Node v26.3.0, npm 11.16.0. [Machine-readable execution metadata](../evidence/lead/results.json) records snapshot, commands and exit codes. Local server/browser operations required approved execution outside the restricted sandbox because listeners returned EPERM there; successful reruns are recorded. No check was disabled.

QA initially identified low-contrast secondary text and overly broad timestamp-year validation. Both have been corrected, with source hashes and initial evidence preserved. Both fixes passed independent retest at the final snapshot. QA checked 684 rendered text samples (including repeated background text), minimum contrast 4.856:1, with no below-target sample. The timestamp probe now rejects unsupported years, offsets, missing milliseconds and invalid dates. Real process restart, touch navigation and viewport geometry also passed. [Initial results](../evidence/qa/initial/results.json) are separate from final evidence.

## Operational plan

- Local prerequisites: Node >=22.12, npm, free loopback ports 5173 and 3001. Install pinned dependencies with `npm ci`; run `npm run dev`; open `http://127.0.0.1:5173`.
- Build inspection: `npm run build` creates `dist/client` and `dist/server`; `npm start` starts the compiled API only. This is not a production hosting arrangement.
- Migration ordering: N/A for V1 because all data is synthetic and in memory. No database, external credentials or external provider writes exist.
- Health/success signals: `GET /api/v1/health` returns demo liveness; all required checks pass; accounts/source counts and last-good events remain correct through sync failure and retry.
- Rollback trigger: regression in timeline usability, denied access behavior, data invariants or required checks. Stop owned local processes with Ctrl+C, restore the reviewed source snapshot from version control/backups, run `npm ci` and repeat checks. Restart resets synthetic data, including source selections and connected profiles.
- Ownership: Lead coordinates rollout/rollback and issues; Frontend owns UI defects, Backend owns API/data defects, QA independently retests.
- Production prerequisite: separately review actual identity, durable storage, encrypted tokens/consent, provider sync operations, infrastructure, monitoring, migration/recovery, and explicit approval of the exact deployment revision and environment.

## Risks and follow-ups

| Risk / follow-up | Impact | Owner | Resolution |
| --- | --- | --- | --- |
| Spoofable demo identity | Unsuitable for public exposure or real private data | Architect / Backend | Explicitly local-only; production auth deferred |
| Ephemeral state | Restart resets demo changes | Backend | UI/README explain behavior; independent real-process restart check passed |
| Simulated providers and enrichment | Does not validate Google OAuth/Gmail/provider production behavior | Architect / Backend | Real integration requires new scoped work |
| Usability research not run | Product success target is unproven | Lead / product owner | Future moderated study: at least four of five complete core journey within 60 seconds |
| CI not configured | No remote reproducibility signal | Lead | Local reproducible scripts/evidence provided; add CI when delivery pipeline is chosen |
| Browser/accessibility scope | Chromium/mobile emulation and targeted keyboard checks only | Frontend / QA | No full accessibility certification or cross-browser claim |

## User deployment approval

- Approval: **NOT REQUESTED / NOT GRANTED**
- Approving user/reference: none. User explicitly prohibited deployment without approval.
- Exact production revision and target: none selected or approved.
- Scope: local implementation and verification only. No deployment or external account access occurred.

READY FOR USER REVIEW, if later recorded, applies only to this prototype and does not authorize deployment.

## Final handoff

All required local gates and all 12 acceptance criteria passed. Lead inspected QA report, raw command metadata and final integrity evidence; QA rehashed all 50 source/config/accepted-contract entries with zero changes. No unresolved local-prototype blockers. Final evidence includes [desktop preview](../evidence/lead/overview-desktop.png), [phone preview](../evidence/lead/overview-mobile.png), [supplemental QA metadata](../evidence/qa/supplemental-results.json), and [build hashes](../evidence/lead/build-sha256.txt). Source files are intentionally uncommitted; no commit or push was requested.
