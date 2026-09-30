# Little's law

Cap WIP ≤2. Single-implementer fallback: ~/.config/opencode/skills/mas/SKILL.md. Readers fan out only when no P-BLOCKING or P-WRITE task exists.

# Backpressure

Keep one flow: EDIT→BUILD→LINT→REPORT before the next pull. Never open a pull while a gate is unresolved. Gate commands, blocking statuses, and clean-context re-spawn are in `~/.config/opencode/skills/mas/references/verification.md` Gate + Retry budget.

# Work-stealing

Idle agents steal from loaded queues. Keep batches balanced, and keep same-level tasks disjoint.

# Supervision

Silence-first: speak on batch stop, escalation, and handoff. Steer in ≤3 sentences. The `Step N/7` status lines in the transcript ARE the resume cursor. Resume from them, never from a truncated transcript.

Declared pause points are the HITL (human-in-the-loop) gates in `~/.config/opencode/skills/mas/references/verification.md` HITL gates. A declared HITL gate IS a legal turn boundary.

# Risk classes and escalation

Classify every capability into exactly one class. The classes are `read` (observing), `write` (mutating a file), and `execute` (running a command or reaching the network).

When a capability's class is not obvious, escalate to the operator. Never guess downward. Deny any capability you cannot classify rather than assume it safe.

# Feedback to re-entry

Feedback → re-entry is the ONLY statement of each rule:

- **approach change**: redesign, re-spawn.
- **implementation redo**: re-spawn affected files.
- **verification add**: add check.
- **scope/feature add**: re-decompose.
- **decision override**: re-decompose corrected.

# Loop guardrails (cap + autocycle)

Budget, oscillation, re-spawn seeding, and retry cap are in `~/.config/opencode/skills/mas/references/verification.md` Retry budget + Loop budget. Bounds are in `~/.config/opencode/skills/mas/references/decomposition.md` Breadth rule. Autocycle is in `~/.config/opencode/skills/mas/references/diagnosis.md` Failure patterns.

Never stall on a bare question. A stall is FAILED the same turn. Ask a clarifying question only when the answer would change the route or the plan. Otherwise proceed.

Cap at 3. A question that does not change the route or the plan is not asked. Confirm-when-unsure: if information is insufficient, spawn a scoped discoverer or researcher, and never guess. If you weaken a gate, restore the baseline. Then re-spawn per `~/.config/opencode/skills/mas/references/verification.md` Retry budget and `~/.config/opencode/skills/mas/references/diagnosis.md` Failure patterns.

# Context discipline

Keep a session log plus per-delegate summaries. Compact ONLY at step boundaries, never mid-derivation. Emit a pressure warning before eviction.

The session log is append-only. Never re-summarize a summary.

# Contested artifact cross-check

Local coherence is not global coherence. After composing work from more than one agent, check that the parts glue. This check is mandatory, not conditional on a prior disagreement.

Two agents may assert incompatible things about the same target. That conflict is a ship blocker, even when each part passed its own check.

The contested artifact case is when two agents' verdicts disagree, and there the check fires early. Run at most ONE bounded cross-check round, never a default path, and cost-account it against the loop budget. No round 2, no unbounded exchange.
