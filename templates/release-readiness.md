# Release readiness: <release>

Status: NOT READY | READY FOR USER REVIEW | APPROVED FOR DEPLOYMENT
Lead: <owner>
Release revision/artifact: <immutable identifier>
Target environment: <explicit target; do not assume production>
QA report: <link and reviewed snapshot>

## Delivered scope

<Behavior changed, fulfilled acceptance criteria, and relevant documentation.>

## Evidence and gates

- [ ] Requirements, architecture, and contracts match this revision.
- [ ] Lint, type checks, tests, and build passed on the final integrated state.
- [ ] Required CI checks passed on this revision, or CI is not configured and
      the limitation and local evidence are explicitly recorded.
- [ ] Independent QA completed with evidence and a READY recommendation.
- [ ] No unresolved critical/high defects, failed required checks, or unverified
      acceptance criteria; lesser residual risks are listed with owners.
- [ ] Configuration, secrets handling, migrations, compatibility, and recovery reviewed.
- [ ] Rollout, monitoring, rollback, and support ownership established as applicable.

| Gate | Command / CI run / procedure | Outcome | Evidence | Limitations |
| --- | --- | --- | --- | --- |
| <gate> | <exact reference> | <status> | <link> | <details or none> |

Any unchecked required gate blocks readiness. N/A requires a concrete reason.
Never bypass failed checks, and never describe missing evidence as success.

## Operational plan

- Prerequisites and deployment steps: <reviewable steps>
- Migration ordering and compatibility: <steps and constraints>
- Health signals and success thresholds: <what to observe and for how long>
- Rollback triggers and steps: <including data recovery limitations>
- Owners and escalation: <who responds to failure>

## Risks and follow-ups

| Risk / follow-up | Impact | Owner | Resolution / explicit acceptance |
| --- | --- | --- | --- |
| <item> | <impact> | <owner> | <evidence> |

## User deployment approval

- Approval: **NOT REQUESTED / NOT GRANTED**
- Approving user and explicit approval reference: <message/reference>
- Exact release revision and target: <identifiers>
- Approved scope and date: <details>

The Lead prepares evidence before requesting approval. READY FOR USER REVIEW is
not approval. Never infer consent from a request to build, a QA verdict, or an
unchecked template. A changed artifact requires renewed review and approval.
