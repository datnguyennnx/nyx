# Little's Law — proven

L=λW: cap WIP ≤2 to bound wait. Single-implementer fallback: ~/.config/opencode/skills/mas/SKILL.md Readers fan out only when no P-BLOCKING/P-WRITE.

# Backpressure — proven

One flow: EDIT→BUILD→LINT→REPORT before the next pull; never open a pull while a gate is unresolved. Gate: build + `~/.config/opencode/scripts/validate-mas.mjs` + `~/.config/opencode/scripts/envelope-lint.mjs`, all exit 0 → `~/.config/opencode/skills/mas/references/verification.md`.

# Work-Stealing — proven

Idle agents steal from loaded queues; keep batches balanced and same-level tasks disjoint. Expected time T1/P+O(Tinf).

# Supervision

Silence-first: speak on batch stop, escalation, handoff; steer ≤3 sentences. `Step N/7` status lines in-transcript ARE persisted state — resume from last status line.

# Feedback → Re-entry

| Pattern | Action |
|---|---|
| Approach change | Redesign, re-spawn |
| Implementation redo | Re-spawn affected files |
| Verification add | Add check |
| Scope/feature add | Re-decompose |
| Decision override | Re-decompose corrected |

# Loop Guardrails (cap + autocycle)

Budget → `~/.config/opencode/skills/mas/references/verification.md` Retry Budget; bounds → `~/.config/opencode/skills/mas/references/decomposition.md` Breadth Rule; Autocycle → `~/.config/opencode/skills/mas/references/diagnosis.md` Auto-Cycle.

Never stall on a bare question — else FAILED same turn. Ask user only if request uninterpretable AND zero spawns yet. Confirm-when-unsure: insufficient info → spawn scoped discoverer/researcher, never guess. Gate weakening → restore baseline, re-spawn fresh with prohibition (`~/.config/opencode/skills/mas/references/diagnosis.md` Failure Patterns §6).

# Re-spawn

Retry Budget: ~/.config/opencode/skills/mas/references/verification.md
