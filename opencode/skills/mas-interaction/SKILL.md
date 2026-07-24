---
name: mas-interaction
description: "Reference for meta-cognitive assessment, feedback classification, human handoff, and re-spawn diversity strategy in ship-mas orchestration."
---

# Meta-Cognitive Assessment

## Difficulty Assessment
See mas-verification skill for the difficulty assessment table. (Canonical location.)

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

## Human Handoff
When uncertainty about the correct next action is high:
- Uncertainty > 0.7 AND steps < 3 → spawn additional discoverer/analysis agent
- Uncertainty > 0.7 AND steps ≥ 3 → ASK USER — present findings + recommendation
- Uncertainty < 0.3 → proceed (satisficing)

**Steps counter**: Each spawned agent invocation increments the step counter for the current decision context. Steps reset when a decision is reached.

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
| 2 | Include discovery findings + research results — broader context and additional evidence | Catches missing imports, interface changes |
| 3 (if needed) | Escalate — problem may be structural | After 2 attempts, deeper redesign needed |
