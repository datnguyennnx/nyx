---
name: mas-fast-path
description: Fast Lane manifest shape and escalation policy. Conceptual definitions only — pipeline execution is handled by the TS Engine. Loaded by the task-decomposer.
---

## Fast-Lane Manifest Shape

- `nodes[]`: exactly 1 node
- `edges[]`: empty
- `levels[]`: `[["N1"]]`
- `phase_chain`: implement + gate only (no discover/architect/verify/fix)
- `retry_budget`: `{ max_respins: 0 }` — no re-spin, escalate on failure

Trigger conditions: see `mas-workflow` Fast-Lane Gate.

## Escalation Policy

If edge-judge REJECTS a fast-lane node, engine escalates immediately (no re-spin). ship-mas mode re-spawns task-decomposer to produce a `full_dag` manifest.

## Auto-Apply Threshold

Decomposer may set `hitl.required: false` when ALL: diff ≤10 lines (estimated) AND no new exports in `exports_delta` AND single file target. Otherwise `hitl.required: true`.
