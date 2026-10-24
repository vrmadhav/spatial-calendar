# ADR-<number>: <decision>

Status: PROPOSED | ACCEPTED | SUPERSEDED
Date/revision: <date and revision>
Owner: Architect
Related requirements: <links / AC IDs>
Supersedes / superseded by: <link or none>

## Context and constraints

<Problem, existing design, workload, constraints, and why a decision is needed.>

## Options considered

| Option | Benefits | Costs / risks | Why selected or rejected |
| --- | --- | --- | --- |
| <simplest viable option> | <benefits> | <costs> | <reason> |
| <alternative> | <benefits> | <costs> | <reason> |

## Decision

<Chosen approach and rationale. Defer providers and irreversible choices until
requirements justify them. Document any intentional deferral.>

## Boundaries and data model

- Components and responsibilities: <boundaries and dependency direction>
- Data ownership, entities, invariants, and lifecycle: <details>
- Interfaces and contract revision: <links>
- Trust boundaries and threats: <untrusted sources, auth, authorization, isolation>
- Privacy and secrets: <handling and retention>

## Failure, scale, and operations

- Failure modes and mitigations: <timeouts, retries, idempotency, transactions>
- Performance assumptions and limits: <measurable workload and capacity>
- Observability and recovery: <logs/metrics, health, backup/restore where applicable>
- Migration, compatibility, rollout, and rollback: <steps and constraints>

## Consequences and validation

- Tradeoffs / residual risks: <details and owners>
- Verification plan: <tests or experiments and acceptance thresholds>
- Revisit triggers: <evidence that would change this decision>

## Agreement

| Role | Accepted revision | Acknowledgment / date | Outstanding blocker |
| --- | --- | --- | --- |
| Engineering Lead | <revision> | <evidence> | <none or blocker> |
| Architect | <revision> | <evidence> | <none or blocker> |
| Affected implementer(s) | <revision> | <evidence> | <none or blocker> |

Implementation starts only after blockers are resolved and agreement is recorded.
