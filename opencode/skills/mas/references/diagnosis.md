# Auto-Cycle

Every failure re-enters same turn: diagnostician (fresh context) → re-spawn with fix delta → re-gate, emitting ONE canonical envelope (`PASS|FAIL|PARTIAL|NO_VERIFICATION|NO_RESULTS`). One budget unit per cycle → `~/.config/opencode/skills/mas/references/verification.md` Retry Budget. Halts only on budget exhaustion or all-failed-batch stop; gate configs immutable.
# Failure Patterns

1. N+1 type break from N: gate per-level combined, not per-task. Fix: combined build before N+1; add P-BLOCKING producer→consumer.
2. Same-file conflict: overlapping sets in one batch. Fix: disjoint re-split or P-WRITE serialize.
3. Gate PASS but off-requirement: missing coverage map. Fix: Coverage Envelope, unmatched → auto retry queue.
4. Loops never converge: unclassified feedback. Fix: classify per `~/.config/opencode/skills/mas/references/interaction.md` before acting; cap by budget.
5. Whole batch same FAIL: hidden shared dep. Fix: collapse to ONE envelope, ONE diagnostician, ONE retry unit; split only if files+errors provably disjoint.
6. Gate weakening (config relaxed): restore baseline, re-spawn fresh with prohibition. Implementer touches targets only.
7. Over-deliberation: oscillation → scoped discoverer/diagnostician; narrower scope beats more context.
