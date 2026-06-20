---
name: mas-session-state
description: Session state schema, Halt & Stash pattern, state diffing for HITL re-entry.
Loaded by task-coordinator and task-decomposer.
---

## Schema

`.opencode/session-state_<YYYY-MM-DD>_<task-slug>.json` — one per task, append-only history.

```json
{
  "session_id": "YYYY-MM-DD_task-slug",
  "lane": "fast | full",
  "dag_progress": {
    "current_level": 0,
    "completed_nodes": ["node_id"],
    "pending_nodes": ["node_id"],
    "stashed": false
  },
  "stash": {
    "stashed_at_node": "node_id | null",
    "stash_reason": "mid-session interrupt | null",
    "micro_task_id": "string | null",
    "stashed_at_phase": "implement | verify | fix | null"
  },
  "escalation": {
    "escalated_from_fast_lane": false,
    "escalation_reason": "string | null"
  },
  "hitl_feedback": [
    {
      "round": 1,
      "feedback": "string",
      "routed_to": "implementer | architect | verifier",
      "invalidated_nodes": ["node_id"]
    }
  ],
  "tier_violations": [],
  "verdict": "pending | approved | rejected | stashed | escalated"
}
```

## Halt & Stash

Trigger: new Fast Lane-eligible request mid-DAG-execution.

1. Score new request (per `mas-complexity-scoring`)
2. Score < τ:
   a. Wait for current phase to complete
   b. `dag_progress.stashed = true`
   c. `stash.stashed_at_node` = completed node
   d. `stash.stash_reason = "mid-session interrupt"`
   e. Execute Fast Lane → `stash.micro_task_id`
   f. Reload stash, re-hydrate, resume from next phase
3. Score ≥ τ: do NOT stash. Queue after current task.

### Safe Stash Boundaries

After: implement complete, verify PASS, fix complete.

NEVER: mid-phase, during fixer re-spin.

## State Diffing (HITL Re-entry)

1. Parse `hitl_feedback[n].feedback` for scope references
2. Per node in `pending_nodes` / `completed_nodes`:
   - `target_file` overlaps feedback scope → INVALIDATED (re-run from routed stage)
   - No overlap → REUSABLE (output preserved)
3. Record `invalidated_nodes` in feedback entry

Max HITL rounds: 3. After 3 without PASS → pause, surface to user.
