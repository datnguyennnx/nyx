# Little's Law — proven

L=λW: cap WIP to bound wait. Writers ≤2 per batch; readers fan out only when no P-BLOCKING/P-WRITE.
https://en.wikipedia.org/wiki/Little%27s_law

# Backpressure — proven

See `references/verification.md` Gate.
https://unseel.com/cs/backpressure

# Work-Stealing — proven

Idle agents steal from loaded queues; expected time T1/P+O(Tinf). Keep batches balanced, same-level tasks disjoint so steals stay safe.
https://en.wikipedia.org/wiki/Work_stealing

# Supervision

Silence-first: speak on batch stop, escalation, handoff. Steer ≤3 sentences.
Loop state: Step N/9 + Level N lines in-transcript ARE persisted state; resume from last status line.

# Feedback → Re-entry

| Pattern | Action |
|---|---|
| Approach change | Redesign, re-spawn |
| Implementation redo | Re-spawn affected files |
| Verification add | Add check |
| Scope/feature add | Re-decompose |
| Decision override | Re-decompose corrected |

# Loop Guardrails (cap + autocycle)

Budget: see `references/verification.md` Retry Budget; bounds: see `references/decomposition.md` Breadth Rule; Autocycle: see `references/diagnosis.md` Auto-Cycle. Never stall on bare question — else FAILED same turn: `FAIL` + JSON {files, hunks, verification:{build,lint}} + unmatched intents + first FAIL evidence.

Ask user only if request uninterpretable AND zero spawns yet.
Confirm-when-unsure: insufficient info → spawn scoped discoverer/researcher to confirm, never guess; spawning-as-confirmation is not stalling.

# Assertion Weakening

See `references/diagnosis.md` Failure Patterns §6.

# Re-spawn Diversity

1: error output + narrowed scope. 2: discovery + broader context. 3: boundary → FAILED report. Never identical instructions.
