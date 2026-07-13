---
name: mas-session-state
description: Session state schema and state diffing concepts for HITL re-entry. Conceptual definitions only — state management is handled by the TS Engine. Loaded by the ship-mas mode.
---

## Schema

Stored at `./.opencode/session-state_<YYYY-MM-DD>_<task-slug>.json`. One file per task, append-only history. Fields: `session_id`, `workflow_id`, `routing_decision`, `dag_progress` (current_level, completed_nodes, pending_nodes, stashed), `hitl_feedback[]` (round, feedback, category, reentry_phase, invalidated_nodes), `verdict`.

## State Diffing (HITL Re-entry)

1. Parse feedback for file/function/component references.
2. For each node: `target_files` overlaps feedback scope → INVALIDATED (re-run from reentry_phase). No overlap → REUSABLE (output preserved).
3. Record `invalidated_nodes` in feedback entry.

Max 3 HITL rounds. After 3 without PASS → pause, surface to user.
