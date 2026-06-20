---
name: mas-aggregation
description: Subagent output aggregation — format validation, evidence quality, conflict/gap
detection, confidence rollup. Loaded by all ship orchestrators.
---

## Pipeline (4-step)

### Step 1: Format Validation

| Subagent | Required Sections |
|---|---|
| discovery | Findings, Boundary Map, Dependency Graph, Runtime Analysis, Assumptions |
| architect | Assessment, Recommendations, Handoff, Dependency Analysis, Verdict |
| implementer | Changes table, Change Details, Boundary Check, Verification Notes |
| review | Correctness, Issues Found, Compliance, Regression Risk, Verdict |

MISSING section → RE-DELEGATE.

### Step 2: Evidence Quality

Confidence: HIGH (direct file:line) > MEDIUM (pattern-inferred) > LOW (speculative)

Severity: HIGH (blocking/breaking/security) > MEDIUM (degrading) > LOW (cosmetic)

### Step 3: Conflict Detection

| Contradiction Pattern | Action |
|---|---|
| Agent A: "X at file:line" — Agent B: "X not found" | CONFLICT → escalate |
| Architect: "Use A" — Implementer: "Used B" | CONFLICT → escalate |
| Implementer: "Change at file:line" — Review: "No change there" | CONFLICT → escalate |

Never auto-resolve conflicts.

### Step 4: Gap Detection

| Gap | Consequence |
|---|---|
| Discovery has no entrypoint | Architect can't assess |
| Architect has no handoff | Implementer can't start |
| Review has no verdict | Can't make ship decision |
| LOW confidence + HIGH severity finding | Needs verification |

Report gap, do not proceed.

## Aggregation Summary Table

```
| Agent | Format | Confidence | Severity | Gaps | Conflicts | Action |
|---|---|---|---|---|---|---|
| [name] | YES/NO | HIGH/MED/LOW | —/HIGH/MED/LOW | YES/NO | YES/NO | ACCEPT/RE-DELEGATE/ESCALATE |
```

## Cross-Task Conflict Detection

| Check | Method | Action |
|---|---|---|
| File overlap | Compare scope/files across tasks | ESCALATE |
| Pattern inconsistency | Same concern, different solutions | FLAG architect |
| Missing integration | Disconnected pieces, no glue | GAP → integration task |
| Dependency violation | B completed before A (B depends on A) | INVALID → re-run B |

## Task Confidence Rollup

For N tasks, compute weighted mean:

```
C_workflow = (1/N) · Σ_{i=1}^{N} C_i
where C_i = task confidence per Decision Confidence formula
```

| C_workflow | Level |
|---|---|
| ≥ 0.80 | HIGH |
| 0.50 – 0.80 | MEDIUM |
| < 0.50 | LOW |
| Any task FAILED or file overlap | BLOCKED |

## Partial Failure Handling

| Scenario | Action |
|---|---|
| 1 task fails, isolated | Report, continue others |
| Failure reveals systemic issue | Pause all |
| Scope expansion | Halt task, ask orchestrator |
| Unstable (re-verify loops) | Cap at 2 fix cycles, report NEEDS_REDESIGN |
