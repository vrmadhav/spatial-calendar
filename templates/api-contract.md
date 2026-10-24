# API contract: <interface / capability>

Status: PROPOSED | AGREED | SUPERSEDED | NOT APPLICABLE
Contract version/revision: <version and revision>
Owner: Architect
Consumers / implementers: <roles and systems>
Related requirements / ADRs: <links>
If not applicable: <specific reason; remaining sections may be omitted>

## Scope and compatibility

<Protocol and boundary: HTTP, event, function interface, etc. Define compatibility,
versioning, deprecation, and ownership. Link a machine-readable schema when chosen.>

## Operations

Repeat for each operation:

### <operation name / method and path / event>

- Purpose and acceptance criteria: <AC IDs>
- Authentication: <required identity and credential mechanism>
- Authorization: <roles/scopes, resource ownership, tenant isolation>
- Request: <headers, parameters, content type, payload schema>
- Validation: <types, required/optional/null, ranges, size limits, unknown fields>
- Response: <status, headers, typed schema, nullable/omitted fields>
- Errors: <stable codes, safe messages, validation details, retryability>
- Side effects and invariants: <state transitions, transaction boundaries>
- Concurrency and retries: <idempotency, duplicate delivery, ordering, conflicts>
- Pagination/filtering/sorting: <semantics or N/A reason>
- Limits and timeouts: <rate/resource limits and timeout behavior>
- Privacy: <sensitive fields, logging/redaction, retention>

| Case | Request / input example | Response / output example |
| --- | --- | --- |
| Success | <valid input> | <expected output> |
| Invalid input | <invalid input> | <validation error> |
| Unauthenticated / forbidden | <denied request> | <safe error> |
| Conflict / dependency failure | <failure trigger> | <documented error> |

## Contract verification

- Schema source and ownership: <path; avoid competing sources of truth>
- Producer checks: <schema, validation, authorization, failure behavior tests>
- Consumer checks: <contract fixtures/mocks matching this revision>
- Compatibility checks: <existing clients and migration behavior>

## Agreement and change control

| Role | Accepted revision | Acknowledgment / date |
| --- | --- | --- |
| Engineering Lead | <revision> | <evidence> |
| Architect | <revision> | <evidence> |
| Frontend / other consumer | <revision> | <evidence or N/A reason> |
| Backend / producer | <revision> | <evidence or N/A reason> |

Proposed changes return to Architect and the Lead. Reconcile affected consumers,
update the revision and tests, and renew agreement before dependent coding.
