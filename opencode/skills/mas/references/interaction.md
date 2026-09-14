# Little's Law
Cap WIP ≤2. Single-implementer fallback: ~/.config/opencode/skills/mas/SKILL.md. Readers fan out only when no P-BLOCKING/P-WRITE.

# Backpressure
One flow: EDIT→BUILD→LINT→REPORT before the next pull; never open a pull while a gate is unresolved. Gate commands, blocking statuses and clean-context re-spawn: ~/.config/opencode/skills/mas/references/verification.md Gate + Retry Budget.

# Work-Stealing
Idle agents steal from loaded queues; keep batches balanced and same-level tasks disjoint.

# Supervision
Silence-first: speak on batch stop, escalation, handoff; steer ≤3 sentences. `Step N/7` status lines in-transcript ARE the resume cursor — resume from them, never from a truncated transcript. Declared pause points are the HITL gates in `~/.config/opencode/skills/mas/references/verification.md` HITL Gates; a declared HITL gate IS a legal turn boundary.

# Risk Classes and Escalation
Classify every capability into exactly one class: `read` (observing), `write` (mutating a file), `execute` (running a command or reaching the network). When a capability's class is not obvious, escalate to the operator — never guess downward. A capability that cannot be classified is denied rather than assumed safe.

# Feedback → Re-entry

Feedback → re-entry, the ONLY statement of each: approach change → redesign, re-spawn; implementation redo → re-spawn affected files; verification add → add check; scope/feature add → re-decompose; decision override → re-decompose corrected.

# Loop Guardrails (cap + autocycle)
Budget, oscillation, re-spawn seeding and retry cap → `~/.config/opencode/skills/mas/references/verification.md` Retry Budget + Loop Budget; bounds → `~/.config/opencode/skills/mas/references/decomposition.md` Breadth Rule; Autocycle → `~/.config/opencode/skills/mas/references/diagnosis.md` Auto-Cycle.

Never stall on a bare question — else FAILED same turn. Ask user only if request uninterpretable AND zero spawns yet. Confirm-when-unsure: insufficient info → spawn scoped discoverer/researcher, never guess. Gate weakening → restore baseline, re-spawn per `~/.config/opencode/skills/mas/references/verification.md` Retry Budget + `~/.config/opencode/skills/mas/references/diagnosis.md` Failure Patterns.

# Context Discipline
Keep a session log plus per-delegate summaries. Compact ONLY at step boundaries — never mid-derivation. Emit a pressure warning before eviction. The session log is append-only; a summary is never re-summarized.

# Contested Artifact Cross-Check
At most ONE bounded cross-check round, only for a contested artifact (two agents' verdicts disagree), never a default path, cost-accounted against the loop budget. No round 2, no unbounded exchange.
