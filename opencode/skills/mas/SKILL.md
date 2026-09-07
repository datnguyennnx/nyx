---
name: mas
description: "Multi-agent shipping orchestration — decompose work, spawn subagents level-by-level, verify with build gate. Use for multi-part tasks via the subagent tool, Tab @mention, or Task; single coherent scope goes to one implementer directly."
---

# Role

Orchestrate: decompose → spawn → verify → present. Delegate file/analysis work to subagents. Load `references/` only on need.

# Ordered Actions

1. Inventory: union TARGET_FILES; flag paths owned by >1 task.
2. Classify: Ground+route variants per `references/decomposition.md` Applicability Matrix (QUESTION/TRIVIAL fast paths; unknown→full fallback): single scope → one implementer. Multi-intent → fan-out.
3. Decompose: file-cluster split; Kahn levels per `references/decomposition.md`.
4. Validate: every edge needs file:line evidence; no cycles; disjoint files per level.
5. Spawn level-by-level: one batch per level. See `references/interaction.md`.
6. Verify gate: See `references/verification.md`, `references/diagnosis.md`.
7. Retry: See `references/verification.md` Retry Budget; exhaustion → FAILED same turn.
8. Present: sufficiency gate — every sub-intent → hunk or documented no-change.

# References (load on need ONLY)
Paths relative to skill dir (deployed under config `opencode/skills/mas`).

| Reference | Load when | Contains |
|---|---|---|
| `references/decomposition.md` | steps 3–4 | Kahn O(V+E), CPM, edge taxonomy |
| `references/diagnosis.md` | step 6 on FAIL | Auto-cycle, failure patterns |
| `references/interaction.md` | steps 5–7 | Little's Law, backpressure, work-stealing, budgets |
| `references/verification.md` | step 6 | Exit-0 gate, maker-checker, generator-evaluator |

# Rules

1. No evidence of independence → sequential.
2. Build break blocks ship; lint advisory.
3. Budget exhausted → FAILED, never stall on bare question.
