---
name: mas-interaction
description: "Reference for meta-cognitive assessment, feedback classification, human handoff, and re-spawn diversity strategy in ship-mas orchestration."
---

# Meta-Cognitive Assessment

## Difficulty Assessment

Before any interaction with spawned agents, classify the overall task difficulty. This feeds the Meta-Cognition Gate (see reference/verification.md):

| Factor | Simple | Medium | Complex |
|--------|--------|--------|---------|
| Target files | ≤2 | 3-5 | >5 |
| Dependencies | ≤1 | 2-3 | >3 |
| Description length | <200 chars | 200-500 chars | >500 chars |
| Domains | 1 | 2 | 3+ |
| Cross-team? | No | No | Yes |

The orchestrator performs this assessment once, at task ingestion, and uses it to select the pipeline depth (see verification.md Meta-Cognition Gate).

---

## Feedback Classification

| Pattern | Re-entry Action |
|---|---|
| Approach change | Orchestrator redesigns approach, passes to implementer |
| Implementation redo | Re-spawn implementer for affected files |
| Verification add | Orchestrator adds new check to requirements |
| Scope change / Feature add | Re-decompose with new scope |
| Decision override | Re-decompose with corrected approach |

## Loop Guardrails

Max 3 feedback loops. At 4th: pause, ask user. Preserve history. Flag scope creep. Always HITL confirm before re-spawn.

## Human Handoff Decision Framework

When uncertainty about the correct next action exceeds thresholds, the orchestrator must decide between analyzing more and asking the user. Use this decision matrix:

| Condition | Action |
|-----------|--------|
| Uncertainty > 0.7 AND steps < 3 | Analyze more — spawn an additional discovery/analysis agent |
| Uncertainty > 0.7 AND steps ≥ 3 | **ASK USER** — present findings, options, and recommendation |
| Uncertainty < 0.3 | Proceed (satisficing) — confidence is sufficient |
| Uncertainty 0.3-0.7 | One more analysis step, then re-evaluate against same matrix |

**Uncertainty estimation** (heuristic, computed by orchestrator):

```
uncertainty = 1 - mean(soft_confidence_across_completed_tasks)
```

If no tasks completed yet, estimate from:
- Proportion of `edges[]` without strong evidence (thin citations)
- Number of unresolved discovery pairs (pairs where discovery returned "not checked")
- C_total value from complexity-score.mjs (C_total > 0.5 → higher uncertainty)

**Steps counter**: Each spawned agent invocation increments the step counter for the current decision context. Steps reset when a decision is reached.

This framework prevents the orchestrator from either (a) spinning indefinitely without resolution or (b) prematurely interrupting the user with low-confidence questions.

## Interrupt Classification

| Signal | Action |
|---|---|
| New request, idle | Full routing |
| New request, agents running, score < tau | Halt current, stash state |
| New request, agents running, score >= tau | Queue after current |
| `!quick` prefix | Force fast-lane |
| `!stop` / `!cancel` | Abort pipeline, preserve stash |
| Frustration signal | Write-lock, route to clarification |
| Uncertainty > 0.7 AND steps ≥ 3 | Halt current, ASK USER (handoff) |

## Frustration Detection

ALL must hold across last 3 messages: avg length < 15 tokens AND >=2 of 3 contain negation (EN: no/wrong/stop/not/undo/revert/broken; VI: khong/sai/dung/thoi/huy/loi). On detection: write-lock — no file modifications until `!continue` or new scope.

## Write-Lock

ALLOWED: read-only discovery, clarification. BLOCKED: file-modifying tasks. Lifts on: new scope, `!continue`, `!rollback`.

## Interrupt vs New Task

References active task's target_files → INTERRUPT. Otherwise → NEW TASK. Default NEW TASK.

## Session State

Track in memory: current tasks, completed, pending, HITL rounds. On re-entry: diff feedback against scope — invalidated tasks re-spawned, valid preserved.

## Assertion Weakening Detection

When re-spawning implementer after a failure, check that verification criteria are not weakened rather than fixing the actual output. Documented failure mode in autonomous test repair systems (arXiv 2605.01471).

Detection rules:
1. After each implementer re-spawn, diff the project's build config files against the baseline captured before the first attempt.
2. If any strictness setting was relaxed (e.g., strict: true → false, noUnusedLocals: true → false, or eslint rules changed from error → warn), halt immediately.
3. Do NOT auto-retry after assertion weakening is detected. Escalate to user with the diff of weakened settings.

Response: Write-lock the pipeline. Present the weakened config diff to the user. Require explicit `!continue` to proceed.

## Re-spawn Diversity Strategy

When re-spawning implementer after failure, vary the approach:

| Attempt | Strategy | Reasoning |
|---------|----------|-----------|
| 1 | Pass error output + narrowed file scope | Works for simple errors |
| 2 | Include broader context (dependencies, related files) | Catches missing imports, interface changes |
| 3 (if needed) | Escalate — problem may be structural | After 2 attempts, deeper redesign needed |
