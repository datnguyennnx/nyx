---
name: mas-fast-path
description: Fast Lane pipeline — reduced path for low-complexity tasks. Hotpatch implementer,
Lite Verifier constraints, re-spin (max 0), auto-apply threshold. Loaded by classifier and task-coordinator.
---

## Trigger

ALL must hold:
1. C(T) < τ (per `mas-complexity-scoring`)
2. |task_set| = 1
3. |output_files| ≤ 2

OR: `!quick` prefix (overrides all).

## Pipeline

Full DAG: `discover → architect → implement → verify ⇄ fix → edge-judge → ast-aggregator → global-judge → HITL → apply`

Fast Lane: `hotpatch-implementer → lite-verifier → [HITL if above auto-apply] → apply`

Fast Lane skips: discover, architect, fixer loop, edge-judge, ast-aggregator, global-judge.

## Hotpatch Implementer Constraints

- ≤ 2 files
- Diff-only output (unified diff, never full file)
- Context ≤ 1K tokens (signatures only, no cross-file reads)
- Every change cites `file:line`
- No new exports or imports (→ escalate if needed)

## Lite Verifier Constraints

Verifier Fast Path mode only:
- `diff_size < 50`, `new_imports` empty, `new_exports` empty
- No domain skills loaded
- No anti-pattern, cross-file, Layer/component boundary checks
- Checks: TypeScript syntax on diff hunks, scope ≤ 2 files, citation coverage ≥ 60%

New imports or exports → reject, escalate.

## Re-spin

Max = 0. BLOCKING → escalate to full DAG immediately.

## Auto-Apply

Apply without HITL: diff ≤ 10 lines AND Lite Verifier PASS AND no new exports.

Otherwise: present diff for approval.

## Session State

`lane: "fast"` mandatory. Full DAG = `lane: "full"`.
