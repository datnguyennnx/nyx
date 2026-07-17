---
name: mas-interaction
description: HITL feedback, loop guardrails, interrupt detection, frustration signals. For ship-mas orchestrator.
---

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
