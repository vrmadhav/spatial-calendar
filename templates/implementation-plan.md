# Implementation plan: <feature>

Status: DRAFT | READY | IN PROGRESS | BLOCKED | COMPLETE
Lead: <session / owner>
Requirements revision: <link and revision>
Architecture / contract revisions: <links and revisions>

## Preconditions

- [ ] Acceptance criteria and scope agreed.
- [ ] Architecture accepted; Lead, Architect, and affected implementers acknowledged.
- [ ] API contract agreed, or specific N/A reason recorded.
- [ ] Blocking questions resolved; remaining assumptions recorded.
- [ ] Verification commands and evidence locations established.

## Tasks and ownership

| ID | Deliverable / AC IDs | Agent | Dependencies | Exclusive writable paths | Status |
| --- | --- | --- | --- | --- | --- |
| T-01 | <deliverable> | <role> | <IDs> | <exact files/directories> | <status> |

- Shared files reserved to Lead: <schemas, configuration, lockfiles, etc.>
- Permitted parallel groups: <task IDs and why independent>
- Sequential work: <dependencies, integration, final QA>
- Ownership transfers: <from/to, files, previous task stopped/completed, acknowledgment>

## Delegation packet

Use for each assigned task:

```text
Agent / task ID:
Objective and acceptance criteria:
Inputs: requirements, accepted architecture and contract revisions:
Writable paths:
Read-only / shared paths:
Prerequisites and dependencies:
Verification commands and expected results:
Return: changed files, decisions, command evidence, risks, blockers, QA notes.
Do not expand ownership or spawn further agents; return new work to the Lead.
```

## Verification commands

| Gate | Exact command | Working directory / environment | Expected result | Evidence path |
| --- | --- | --- | --- | --- |
| Lint | <command> | <context> | <success criteria> | <path> |
| Type check | <command> | <context> | <success criteria> | <path> |
| Automated tests | <command(s)> | <context> | <success criteria> | <path> |
| Build | <command> | <context> | <success criteria> | <path> |
| Additional acceptance / security / recovery | <command or procedure> | <context> | <criteria> | <path> |

Replace placeholders with actual repository commands before implementation.
Document true N/A with a reason; missing tooling is BLOCKED, not N/A.

## Integration and QA

- Integration owner and sequence: <Lead; shared changes and ordering>
- Final reviewed snapshot: <commit plus dirty diff/evidence if applicable>
- Independent QA assignment: <agent instance and scope>
- Defect remediation and retest loop: <owners and affected checks>
- Completion report: <QA report and release-readiness links>

No production deployment is part of this plan without explicit user approval.
