---
name: mas
description: "MAS multi-agent shipping orchestration: file-disjoint slices, Kahn CPM schedule, exit-0 gate. Use when tasks span files/intents. Triggers: mas, orchestration, multi-agent, spawn, decompose, Kahn, verify, ship."
---

# Role

Delegate-only orchestrator: spawn subagents for ALL file/analysis work; never read files or run scripts directly. Use Code Mode `search` for bulk retrieval and `question` for ≤3 blocking clarifications.

# Step N/7 — canonical

0. **Step 0/7 — Ground+Classify.** Premise-check vs repo (+ optional discoverer/explore scan); union TARGET_FILES; route via the Applicability Matrix in `references/decomposition.md`; ≤3 `question` if uninterpretable.
1. **Step 1/7 — Scan.** Scoped discoverer/explore; returns `file:line`, never pasted content.
2. **Step 2/7 — Plan (Kahn/CPM).** File-cluster split; Kahn levels + CPM order per `references/decomposition.md`; every edge carries `file:line`; no cycles.
3. **Step 3/7 — Spawn.** One batch per Kahn level, level-by-level; pull model, WIP ≤2; budgets in `references/interaction.md`.
4. **Step 4/7 — GATE (exit-0).** `~/.config/opencode/scripts/validate-mas.mjs` AND `~/.config/opencode/scripts/envelope-lint.mjs` must each exit 0; maker-checker + envelope per `references/verification.md`; FAIL → `references/diagnosis.md`.
5. **Step 5/7 — Sufficiency (R-2).** Consume the tester's `S-N → file:line` table; every requirement matched else FAILED + narrowed re-spawn.
6. **Step 6/7 — Auto Report.** Emit the canonical envelope defined once in `references/verification.md`.

# References

| Reference | Step |
|---|---|
| `references/decomposition.md` | 0/7–2/7 |
| `references/interaction.md` | 3/7 |
| `references/verification.md` | 4/7–6/7 |
| `references/diagnosis.md` | 4/7 on FAIL |

# Rules

- WIP ≤2 concurrent implementer tasks per batch; one implementer owns one task; tasks file-disjoint. Use a single implementer when the change is one atomic unit or independence is unproven.
- Backpressure: finish EDIT → BUILD → LINT → REPORT before the next pull.
- Kahn: indegree-0 nodes only; a cycle = halt, never guess past it. exit-0 GATE blocks ship; lint advisory only.
- Retry Budget: ~/.config/opencode/skills/mas/references/verification.md
- Evidence rule: ~/.config/opencode/skills/mas/references/verification.md
