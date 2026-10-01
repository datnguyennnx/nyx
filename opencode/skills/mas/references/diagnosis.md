# Diagnosis

When a lane fails, the failure re-enters in the same turn. One budget unit covers one cycle. Escalation has four tiers: local fix, then re-plan, then state recovery, then HITL-4.

Gate configuration stays immutable after a first gate failure. For re-spawn and retry mechanics, see `~/.config/opencode/skills/mas/references/verification.md`.

Diagnosis output stays terse and exact: one claim per line with a `file:line`; never pad with prose and never restate the symptom; numbers stay exact.

# Failure patterns

MAST classes: FC1 system and specification, FC2 inter-agent misalignment, FC3 task verification.

1. FC1: N+1 type break from N, because the gate runs per level combined, not per task. Fix: run a combined build before N+1, and add a P-BLOCKING `producer→consumer` edge.
2. FC1: same-file conflict, because one batch has overlapping sets. Fix: re-split into disjoint sets, or add P-WRITE serialize.
3. FC3: gate PASS but off-requirement, because the coverage map is missing. Fix: add a Coverage Envelope (`S-N -> file:line`), and send unmatched items to the auto retry queue.
4. FC1: loops never converge, because feedback is unclassified. Fix: classify per `~/.config/opencode/skills/mas/references/interaction.md` before you act, and cap by budget.
5. FC1: the whole batch gets the same FAIL, because a shared dependency is hidden. Fix: collapse to ONE envelope, ONE diagnostician, and ONE retry unit; split only if files and errors are provably disjoint.
6. FC1: gate weakening, because the config was relaxed. Fix: restore the baseline, then clean-context re-spawn with a prohibition.
7. FC3: over-deliberation, because of oscillation. Fix: use a scoped discoverer and diagnostician; a narrower scope beats more context.
8. FC2: proceeding on wrong assumptions without clarification. Fix: the planner follows the re-clarification path, restating the underdetermined slice and re-emitting `ACCEPTANCE` before any writer starts.
9. FC3: superficial verification. Fix: use a clean-context checker that receives only the artifact or diff. Give it a distinct objective and have it try to REFUTE the artifact.

# Repairs ledger

Diagnose a failing pattern once, write it down once, and never repeat it.

| fingerprint | symptom | root cause | fix | evidence | date |
|---|---|---|---|---|---|
| _none recorded_ | | | | | |

`fingerprint` = a short stable slug naming the failure's identity, such as `gate-exit0-missing`, not a transcript hash.
`evidence` = a `file:line` or a validator output line, never a summary of a summary.

## Rules

- Search this ledger before diagnosing a new failure.
- Add a row only after the root cause is known.
- One row per distinct fingerprint.
- A recurrence means the fix was wrong: correct that row, do not duplicate it.
- The ledger is operator-maintained. No check applies it automatically.
- A row with no `file:line` evidence is not a repair.
