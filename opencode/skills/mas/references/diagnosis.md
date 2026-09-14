# Diagnosis — when a lane fails
A failure re-enters in the same turn; one budget unit per cycle; escalation is tiered: local fix → re-plan → state recovery → HITL-4. Gate configuration is immutable after a first gate failure. Re-spawn and retry mechanics: `~/.config/opencode/skills/mas/references/verification.md`.

# Failure Patterns
MAST classes: FC1 system/specification, FC2 inter-agent misalignment, FC3 task verification.
1. FC1 — N+1 type break from N: gate per-level combined, not per-task. Fix: combined build before N+1; add P-BLOCKING producer→consumer.
2. FC1 — Same-file conflict: overlapping sets in one batch. Fix: disjoint re-split or P-WRITE serialize.
3. FC3 — Gate PASS but off-requirement: missing coverage map. Fix: Coverage Envelope (`S-N -> file:line`), unmatched → auto retry queue.
4. FC1 — Loops never converge: unclassified feedback. Fix: classify per `~/.config/opencode/skills/mas/references/interaction.md` before acting; cap by budget.
5. FC1 — Whole batch same FAIL: hidden shared dep. Fix: collapse to ONE envelope, ONE diagnostician, ONE retry unit; split only if files+errors provably disjoint.
6. FC1 — Gate weakening (config relaxed): restore baseline, clean-context re-spawn with prohibition.
7. FC3 — Over-deliberation: oscillation → scoped discoverer/diagnostician; narrower scope beats more context.
8. FC2 — Proceeding on wrong assumptions without clarification: planner re-clarification path — the planner restates the underdetermined slice and re-emits `ACCEPTANCE` before any writer starts.
9. FC3 — Superficial verification: clean-context checker — receives only the artifact/diff plus a distinct objective and attempts to REFUTE.

# Repairs Ledger
A failing pattern is diagnosed once, written down once, and never repeated.

| fingerprint | symptom | root cause | fix | evidence | date |
|---|---|---|---|---|---|
| _none recorded_ | | | | | |

`fingerprint` = a short stable slug naming the failure's identity (e.g. `gate-exit0-missing`), not a transcript hash.
`evidence` = a `file:line` or a validator output line; never a summary of a summary.

## Rules
- Search this ledger before diagnosing a new failure.
- Add a row only after the root cause is known.
- One row per distinct fingerprint.
- A recurrence means the fix was wrong: correct that row, do not duplicate it.
- The ledger is operator-maintained; no check applies it automatically.
- A row with no `file:line` evidence is not a repair.
