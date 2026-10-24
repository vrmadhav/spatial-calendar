# QA report: <feature / release>

Verdict: NOT VERIFIED | BLOCKED | READY
QA reviewer: <independent agent instance>
Date: <date>
Reviewed snapshot: <commit; if dirty, exact diff or content snapshot reference>
Requirements / architecture / contract: <links and revisions>
Environment: <OS, runtimes, relevant configuration; never include secrets>

## Independence and scope

- Implementation authors: <agents>
- QA contribution: <inspection/tests/reports; disclose any implementation edits>
- Scope and exclusions: <what was and was not reviewed>

If QA changed production code, use a different QA instance for final verification.

## Executed checks

| Check | Exact command / procedure and cwd | Exit code | Status | Result summary | Evidence path |
| --- | --- | --- | --- | --- | --- |
| Lint | <command> | <code or N/A> | <status> | <result> | <path> |
| Type check | <command> | <code or N/A> | <status> | <result> | <path> |
| Tests | <command> | <code or N/A> | <status> | <counts/results> | <path> |
| Build | <command> | <code or N/A> | <status> | <result> | <path> |
| Security / regression / reliability | <procedure> | <code or N/A> | <status> | <result> | <path> |

Statuses: PASS, FAIL, BLOCKED, NOT RUN, N/A. Explain every non-PASS result.
N/A means inapplicable with a reason; unavailable tools/environments are not N/A.

## Acceptance traceability

| AC ID | Test / reproduction | Actual result | Status | Evidence |
| --- | --- | --- | --- | --- |
| <AC-01> | <steps or test name> | <observation> | <status> | <link> |

## Findings

| ID | Severity | Location | Reproduction / expected vs actual | Impact | Owner | Status / retest evidence |
| --- | --- | --- | --- | --- | --- | --- |
| <DEF-01> | <critical/high/medium/low> | <file:line or component> | <steps> | <impact> | <owner> | <open/fixed/verified> |

Critical: severe compromise, data loss, or broad outage. High: major function,
security boundary, or important recovery failure. Medium: material but bounded
defect. Low: minor issue. Severity includes likelihood and impact, not just labels.

## Verdict and limitations

- Blocking findings / missing evidence: <IDs and reasons, or none>
- Remaining risks / untested areas: <details>
- Required fixes and independent retest: <actions>
- Recommendation: <READY only if required checks and acceptance criteria pass;
  BLOCKED for failures/blockers; NOT VERIFIED when evaluation is incomplete>

READY is a QA recommendation, not authorization to deploy.
