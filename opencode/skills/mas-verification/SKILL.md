---
name: mas-verification
description: Build/lint verification, citation quality, ship confidence, conflict detection. For ship-mas orchestrator.
---

## Build/Lint Priority

1. `tsc --noEmit` — BLOCKING if fails
2. `eslint` — BLOCKING if fails
3. Domain checks (conventions, anti-patterns) — NON_BLOCKING unless crash/data-loss/API-break

Compiles+passes lint → ships. Domain violations are feedback, not gates.

## Verification Loop

ship-mas → implementer → tsc+eslint → PASS→HITL → FAIL→fixer(max2)→still fail→ESCALATE

## Citation Quality

Q(c) = min(1.0, log2(c+1)), c = cited_changes/total_changes. c>=0.60 → ACCEPT.

| c | Q | Action |
|---|---|---|
| 0.00 | 0.00 | REJECT |
| 0.50 | 0.58 | MARGINAL |
| 0.60 | 0.68 | ACCEPT |
| 1.00 | 1.00 | FULL_TRUST |

## Anti-Hallucination Heuristics

| Indicator | Confidence |
|---|---|
| No file:line citations | LOW |
| All citations same line | LOW |
| Cites files not in target_files | LOW |
| Finding contradicts diff | LOW |
| Direct file:line evidence per claim | HIGH |

## Conflict Detection (parallel tasks)

| Pattern | Action |
|---|---|
| Two tasks modify same file, no dependency | Re-spawn sequentially |
| A removes import B references | Isolate or resolve |
| A changes export signature, B calls old | Isolate or resolve |
| B depends on A, A not complete | Re-order — spawn A first |

## Ship Confidence

C = (C_cit + C_ver + C_gj) / 3. C_cit = cited/total. C_ver = 1.0/0.5/0.0. C_gj = integrity/100.

| C Range | Level | Action |
|---|---|---|
| >= 0.80 | HIGH | Safe to ship |
| 0.50–0.80 | MEDIUM | Ship with caveats |
| < 0.50 | LOW | Escalate |

## Requirements Coverage

Every R-ID needs APPROVED diff touching acceptance_files. Missing → BLOCKED. Diff outside target_files → UNPLANNED_CHANGE.

## Task Confidence Rollup

C_workflow = (1/N)*sum(C_i). >=0.80 HIGH, 0.50-0.80 MEDIUM, <0.50 LOW, any UNRESOLVABLE → BLOCKED.
