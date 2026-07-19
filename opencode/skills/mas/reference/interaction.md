## Feedback Classification

| Pattern | Re-entry Action |
|---|---|
| Approach change | Re-spawn architect with feedback |
| Implementation redo | Re-spawn implementer for affected files |
| Verification add | Re-spawn verifier with new check |
| Scope change / Feature add | Re-decompose with new scope |
| Decision override | Re-decompose with corrected approach |

## Loop Guardrails

Max 3 feedback loops. At 4th: pause, ask user. Preserve history. Flag scope creep. Always HITL confirm before re-spawn.

## Interrupt Classification

| Signal | Action |
|---|---|
| New request, idle | Full routing |
| New request, agents running, score < tau | Halt current, stash state |
| New request, agents running, score >= tau | Queue after current |
| `!quick` prefix | Force fast-lane |
| `!stop` / `!cancel` | Abort pipeline, preserve stash |
| Frustration signal | Write-lock, route to clarification |

## Frustration Detection

ALL must hold across last 3 messages: avg length < 15 tokens AND >=2 of 3 contain negation (EN: no/wrong/stop/not/undo/revert/broken; VI: khong/sai/dung/thoi/huy/loi). On detection: write-lock — no file modifications until `!continue` or new scope.

## Write-Lock

ALLOWED: read-only discovery, clarification. BLOCKED: file-modifying tasks. Lifts on: new scope, `!continue`, `!rollback`.

## Interrupt vs New Task

References active task's target_files → INTERRUPT. Otherwise → NEW TASK. Default NEW TASK.

## Session State

Track in memory: current tasks, completed, pending, HITL rounds. On re-entry: diff feedback against scope — invalidated tasks re-spawned, valid preserved.

## Assertion Weakening Detection

When the fixer runs, it may attempt to "pass" the GATE by weakening verification criteria rather than fixing the actual output. Documented failure mode in autonomous test repair systems (arXiv 2605.01471).

Detection rules:
1. After each fixer iteration, diff the project's build config files (tsconfig.json, .eslintrc, etc.) against the baseline captured before the fixer started.
2. If any strictness setting was relaxed (e.g., strict: true → false, noUnusedLocals: true → false, or eslint rules changed from error → warn), halt immediately.
3. Do NOT auto-retry after assertion weakening is detected. Escalate to user with the diff of weakened settings.

Response: Write-lock the pipeline. Present the weakened config diff to the user. Require explicit `!continue` to proceed.

## Fixer Iteration Diversity Strategy

When the fixer needs multiple iterations (increased from max 2 to max 3-4), use exponential diversity:

| Iteration | Strategy | Reasoning |
|-----------|----------|-----------|
| 1 | Direct fix based on error message | Fastest path — works for simple errors |
| 2 | Re-read surrounding context before fixing | Broader view catches missing imports, type mismatches |
| 3 | Spawn architect to propose redesign if structural | Complex errors may need redesign, not patching |
| 4 (if configured) | Escalate — structural issue | After 3 attempts, the problem is structural |

Diversity prevents the fixer from repeating the same wrong approach and increases convergence probability.
