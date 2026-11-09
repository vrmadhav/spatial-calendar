# Spatial — Family Calendar

A local prototype of a continuous map of family time. Start with three months, move horizontally, then zoom into a week or day without losing your place. Combine simulated Google calendars, explore travel details, and see how far away plans are.

## Run locally

Requires Node 22.12 or later and npm. Validated environment and exact results are recorded in the release evidence.

```sh
npm ci
npm run dev
```

Open [the local calendar](http://127.0.0.1:5173). Vite serves the UI on loopback port 5173 and proxies `/api` to the Node API on loopback port 3001. Both processes stop with Ctrl+C. Do not expose this demo server to a public network.

The demo starts with Alex and Jamie's simulated Google accounts. Connect the available Sam profile to try combining more sources. Calendar selection is shared household state. Sync can simulate a provider failure and recover without losing the last good events. Disconnect removes that account's calendars and events; reconnect restores the synthetic provider data.

**All data is synthetic. No Google or Gmail access occurs.** Changes live only in server memory: browser reload preserves them, and restarting the server resets the demo. Dates are relative to the server's current day in America/Los_Angeles. Travel details are simulated. The API's `X-Demo-User` header is deliberately spoofable and is not production authentication.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`node scripts/verify.mjs` runs all five gates, captures exit codes and logs, and records a source hash manifest in `evidence/lead/`. Independent QA records separate evidence in `evidence/qa/`. Browser tests use an existing local dev server when available or start their own. Do not run them against real accounts or a non-demo environment.

`npm run build` emits `dist/client` and `dist/server`. `npm start` starts the compiled API only; the documented local UI workflow is `npm run dev`. There is no production hosting configuration or deployment pipeline.

## Boundaries

- `src/client`: React interface, spatial/time helpers, interaction tests.
- `src/server`: Node HTTP API, household-scoped repository, replaceable simulated provider, boundary tests.
- `src/shared/contracts.ts`: provider-neutral wire models and runtime schemas.
- `tests/e2e`: integrated browser journeys at desktop and phone widths.

Identity, households, memberships, external accounts, calendar sources, normalized events and permissions are separate concepts. Server-side membership and role checks cover every household operation. All-day dates use exclusive ends; timed events use UTC instants and display in the household zone. Source/provider event identity makes repeated sync idempotent. Future real integrations require reviewed authentication, encrypted token storage, consent, persistence, synchronization jobs and deployment decisions.

## Product and delivery records

- [Original brief](ProductDescription.md)
- [Users, scope, success targets and acceptance criteria](docs/product-requirements.md)
- [Architecture, data model, trust boundaries and recovery](docs/architecture-decision.md)
- [HTTP v1 contract and permission rules](docs/api-contract.md)
- [Recorded squad agreement and exclusive ownership](docs/implementation-plan.md)
- [Independent QA report](docs/qa-report.md)
- [Release readiness](docs/release-readiness.md)

The proposed usability target—four of five family members finding and inspecting a trip within 60 seconds—requires a future moderated study. Automated checks do not establish that outcome. This repository is a local prototype; production deployment requires explicit user approval of the target and reviewed revision.
