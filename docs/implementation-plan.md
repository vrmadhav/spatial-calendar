# Implementation plan: Spatial Family Calendar V1

Status: COMPLETE
Lead: main Codex session
Requirements revision: [requirements](product-requirements.md), r1
Architecture / contract revisions: [ADR](architecture-decision.md), r1; [API](api-contract.md), v1/r1

## Preconditions

- [x] Brief inspected; mock accounts and local prototype explicitly permitted.
- [x] Requirements and measurable acceptance criteria recorded.
- [x] Architecture accepted by Lead, Architect, Frontend, and Backend.
- [x] Versioned API contract accepted by the same roles.
- [x] No hosting selection or deployment authorized.
- [x] Tooling and verification commands established below.

## Tasks and ownership

| ID | Deliverable | Agent | Dependencies | Exclusive writable paths | Status |
| --- | --- | --- | --- | --- | --- |
| T-01 | Requirements, architecture, normalized model, contract | Architect | Brief inspection | docs/product-requirements.md, docs/architecture-decision.md, docs/api-contract.md | Complete |
| T-02 | Shared contract schema and tooling | Lead | Recorded agreement | src/shared/**, root configuration, package manifests/lockfile, scripts/**, index.html, README.md, .gitignore | Complete |
| T-03 | Responsive calendar and interaction tests | Frontend | T-01 agreement, T-02 interfaces | src/client/** | Complete |
| T-04 | Local API/provider/store and boundary tests | Backend | T-01 agreement, T-02 interfaces | src/server/** | Complete |
| T-05 | Integration and critical browser journeys | Lead | T-03, T-04 | tests/e2e/**, playwright.config.ts | Complete |
| T-06 | Independent final verification | QA | Integrated state | docs/qa-report.md, evidence/qa/**; no production changes | Complete |
| T-07 | Release readiness and handoff | Lead | QA and remediation | docs/release-readiness.md, evidence/lead/**, this plan | Complete |

T-03 and T-04 may run concurrently after agreement. One writer per file. Root configuration, dependencies and schemas remain Lead-owned. Architect may not recursively delegate. Fixes return to the owning implementer, followed by independent QA retest.

## Agreement record

| Role | Accepted revision | Acknowledgment |
| --- | --- | --- |
| Lead | Requirements r1 / ADR r1 / HTTP v1 r1 | Reviewed exact documents and accepted 2026-10-23 before coding |
| Architect | Requirements r1 / ADR r1 / HTTP v1 r1 | Author acknowledgment via architecture agent, 2026-10-23 |
| Frontend | Requirements r1 / ADR r1 / HTTP v1 r1 | Explicit acceptance via frontend agent, no blockers, 2026-10-23 |
| Backend | Requirements r1 / ADR r1 / HTTP v1 r1 | Explicit acceptance via backend agent, no blockers, 2026-10-23 |

## Verification commands

All commands run at `/Users/viggy/Documents/Github/spatial-calendar`. Environment: macOS, Node v26.3.0, npm 11.16.0. Actual results will be recorded with source hashes and exit codes; these entries are plans, not test evidence.

| Gate | Exact command | Expected result | Evidence |
| --- | --- | --- | --- |
| Lint | `npm run lint` | ESLint exit 0 | evidence/lead/lint.log |
| Type check | `npm run typecheck` | strict TypeScript exit 0 | evidence/lead/typecheck.log |
| Unit/integration | `npm test` | Vitest tests pass including boundary/failure cases | evidence/lead/test.log |
| Build | `npm run build` | server TypeScript and Vite production bundles succeed | evidence/lead/build.log |
| Critical browser journeys | `npm run test:e2e` | Playwright passes on desktop/mobile | evidence/lead/e2e.log |

## Delegation packet

Each implementation handoff names accepted document revisions, exact exclusive paths, prohibited shared paths, acceptance criteria, dependencies, commands, evidence and required return information. Agents acknowledge before coding. They may not expand ownership or delegate. Frontend and Backend are separate actual agents; QA will be a distinct actual agent and will not modify production code.

## Integration and QA

Lead integrates shared schemas/tooling before dependent implementation. All required checks are run on the integrated tree; QA independently repeats checks and reproduces acceptance criteria. The reviewed snapshot will be a SHA-256 source manifest plus the base Git revision because the user has not requested a commit. Missing tools and unverified criteria block readiness. CI is currently absent; local evidence is required and remote CI status is not inferred.

No production deployment is part of this plan. Release documentation will preserve approval as NOT REQUESTED / NOT GRANTED.

## Integrated verification handoff

Lead executed `node scripts/verify.mjs` after both implementers declared stable files. All five gates exited 0: lint, strict typecheck, 60 unit/integration tests, production build, and 8 desktop/mobile browser journeys. Actual logs and environment are in `evidence/lead/`, with results in `results.json`. Reviewed source snapshot hash: `4d8935ef8771c5826af3f11b0714dbce68b112b017fc83d40f32b98126614583`; base Git revision `703590e9ded024cc02d4a168e86302764f1f89dd`. Evolving reports, this plan, evidence and generated outputs are excluded from the source manifest. Independent QA was authorized against this state.

Initial sandbox execution could not open local listeners (`EPERM`); approved local execution succeeded. Initial browser checkbox test assumed a synchronous update, conflicting with the accepted server-confirmation behavior; it was corrected to click and assert eventual checked state plus API persistence. A dialog focus edge case with collapsed account details was fixed by Frontend and now has both component and browser regression coverage. No required assertion was removed.

## QA remediation

Independent QA reproduced all initial gates plus a real process restart, touch panning and actual viewport geometry. It reported DEF-01 (medium): meaningful small secondary text below 4.5:1 contrast, and DEF-02 (medium): extended-year ISO timestamps accepted beyond the agreed four-digit-year contract. Frontend retains exclusive ownership of CSS/UI fixes; Lead owns the shared timestamp schema regression and integrated contrast tests. QA does not author fixes. Contract r1 stays unchanged: these are conformance/accessibility corrections. Initial evidence is preserved in `evidence/lead/initial/` and `evidence/qa/initial/`. Readiness stays blocked until final retest.

Final fixes integrated with unchanged r1 contract. Lead reran all five gates, all exit 0:61 unit/API/component tests and10 browser tests. Final source hash `985a4da313aec24e2d8dfdae4f7c119c79ba66ee33409571dd9efca39b35402d`. Independent QA final retest authorized after Lead browser tests completed, avoiding concurrent mutation interference.

Independent QA final verdict READY for local prototype; all 12 AC pass, both findings fixed/verified. Lead checked QA raw results and final-integrity report (50 source files unchanged). Release-readiness record finalized READY FOR USER REVIEW; production approval NOT REQUESTED / NOT GRANTED. No deployment.
