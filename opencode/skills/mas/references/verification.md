# Verification

# Gate

The per-task gate runs the deliverable validators. `~/.config/opencode/scripts/envelope-lint.mjs` checks the produced envelopes, and the gate adds any task-specific check. The TESTER runs them itself and blocks on them.

The operator has not pre-approved shell, so each run reaches the operator as an approval prompt. A missing result yields `NO_VERIFICATION`.

When the task edits mas config (the skill, the agents, or the scripts), the gate also runs `~/.config/opencode/scripts/validate-mas.mjs`. The gate runs that config validator only then, never otherwise. `~/.config/opencode/scripts/envelope-lint.mjs` implements `--selftest`, which runs at authoring time, not per task. `~/.config/opencode/scripts/validate-mas.mjs` runs plain, with no argv. The project build (tsc --noEmit, cargo check, pytest) is the TESTER's gate step and blocks too.

Budget a lane at about 400 changed lines. A lane that exceeds the diff budget without a stated justification in its handoff blocks.

Run a cleanup pass in deletion-first order: dead code, then placeholders, then scaffolding, then duplication, then comments. Run the cleanup check in a fresh context, seeded only by the target files and the requirement, never by the authoring context.

The mechanical gate: run the stack analyzers the project defines and require them to pass before the lane is accepted. A missing analyzer run yields `NO_VERIFICATION`, which counts as FAIL.

For the checks in the gate:

- No gate check is advisory, and the gate never averages signals.
- A check earns its place only if its outcome can change the action.
- A check that cannot change the action does not enter the gate.
- `execute` stays denied.

Local coherence is not global coherence. After composing work from more than one agent, the gate checks that the parts glue. Two agents that assert incompatible things about the same target are a ship blocker, even when each part passed its own check.

When composing work from more than one agent, verify the shared state's facts with provenance, not only each part's self-report.

Worktree isolation:

- A GREEN test baseline is required before spawn and again after the change. A lane that cannot show both greens does not settle PASS.
- Merge-back is verified through a serial merge queue with bisection. The queue merges ONE worktree at a time, and a failure bisects to the offending commit.
- For Best-of-K worktrees the tester is the verifier. It judges the SINGLE envelope at the gate, as everywhere else.
- A worktree does NOT isolate runtime. Ports, databases and caches stay shared. Lanes MUST NOT share live runtime state, so each lane pins its own ports, DB names and cache paths.

Shell scope: the operator approves every shell command. Nothing is pre-approved, so any command reaches the operator as a prompt before it runs. The permission layer refuses a fixed set without a prompt:

- destructive commands (`rm`, `rmdir`, `mv`, `dd`, `truncate`, `shred`, `chmod`, `chown`)
- network egress (`curl`, `wget`, `nc`, `ssh`, `scp`)
- destructive git (`git clean`, `git reset`, `git checkout`, `git restore`, `git -C`)
- interpreter one-liners (`python`, `python3`, `sh -c`, `bash -c`)

The permission layer does not refuse `node`, because the validator scripts are `node` invocations and the tester must run them. A `node` command reaches the operator as a prompt. The permission layer refuses `git -C`, because `*` matches spaces, so no `-C` allow pattern could ever be written safely. To work in another repository, run `cd <repo> && <command>` in ONE shell call, because the permission layer checks each part of a compound command on its own.

An agent MUST NOT use shell to explore or read the tree. Shell reading (`ls`, `cat`, `head`, `grep`, `for` loops, redirects) bypasses the secret-path denies that guard the `read` tool. Exploration and reading go through `glob`, `read` and `grep`, which carry those denies.

No agent runs a build via an arbitrary script. The TESTER runs the deliverable validators, and a missing result yields `NO_VERIFICATION`, which counts as FAIL.

The tester's contribution is READ-ONLY, apart from the deliverable validators, the conditional config validator, and the project build. Read-only work covers read-only git, diff inspection, and requirement→hunk mapping. Judge the SINGLE envelope, not per-printer impressions.

Every finding carries `file:line` (files) or a URL (web). No evidence means `NO_RESULTS`, and never guess.

One further gate INPUT, not a third command: the TESTER obtains the changed-file list itself. It runs `git status --porcelain -uall` in one approved shell call. The OPERATOR supplies that list only if the tester cannot run the command. The tester then compares the two lists.

The declared set for a run is the union of every lane's `TARGET_FILES`. Every path in the changed-file list MUST appear in that declared set. A path that does not is an **undeclared write** → FAIL, because a lane wrote outside its capability contract.

The change set need not be a subset of ONE lane's targets, because different lanes hold different files. Only undeclared paths fail. If the list is unobtainable, that gate input is missing. A missing gate input yields `NO_VERIFICATION`, which counts as FAIL.

`~/.config/opencode/scripts/check-slices.mjs` is NOT part of the gate. It runs before a batch is spawned, and its answer is about the plan, not about the config. The orchestrator runs the native tool `mas_plan_check`; if unavailable, the operator runs `node ~/.config/opencode/scripts/check-slices.mjs`. Every shell command needs operator approval. An exit-0 answer is a spawn precondition, not a PASS condition.

# Handoff dispatch

Dispatch by status received, and this is the statement of record in this file:

| Status | Action |
|---|---|
| `PASS` | proceed to the next level |
| `FAIL` | spawn the diagnostician, then re-spawn per Retry budget |
| `PARTIAL` | re-pull only the declared remaining items |
| `NO_VERIFICATION` | FAIL path per Gate |
| `NO_RESULTS` | re-run once, then escalate |

The orchestrator resolves every rule from its own loaded instructions, never by reading files itself. Subagents read the reference files.

# Terminal states

`PASS`, `FAIL`, `NO_RESULTS` and `NO_VERIFICATION` (see Gate) are terminal. `PARTIAL` is the ONLY non-terminal status, and the dispatch above says what to pull. A lane settles exactly once per attempt, only at the gate. Only a new re-spawn per Retry budget changes a lane after it settles.

# Envelope

```json
{"status":"PASS|FAIL|PARTIAL|NO_VERIFICATION|NO_RESULTS","unit":"task-3","coverage":{"cited":2,"total":2},"remaining":0}
```

ONE clean JSON line, never prose inside it. `raw` is OPTIONAL and FORBIDDEN on PASS. The status set is defined once in the shared-rules contract (`~/.config/opencode/skills/mas/references/shared-rules.md`). Coverage maps `S-N -> <assertion> -> file:line`, one line per assertion; an assertion with no evidence is FAILED.

# Acceptance, typed, not exit codes

Every delegation declares a machine-checkable ACCEPTANCE assertion set (test ids, artifact paths, schema checks, state assertions), never a bare exit code. Gates consume assertions, and an unmatched assertion is FAILED, not partial. An over-tight set creates false FAILs. Re-scope it, never weaken the gate.

Test-first rule:

- For route CODE, write the failing check (RED) before the change (GREEN). Acceptance is the test going RED then GREEN.
- Non-trivial logic leaves ONE runnable check behind.
- Explicit waiver: route TRIVIAL does not require a test.

# Token caps

Caps by status, and this is the statement of record in this file:

- `PASS`: status line ≤50, envelope ≤1000, coverage only, no `raw`.
- `FAIL`: ≤300 (≤800 with URL/`rootCause`/NO_RESULTS), raw tail ≤20 lines.
- `PARTIAL`: ≤300, valid-subset + `remaining:N`.
- `NO_VERIFICATION`: ≤400, reason.
- `NO_RESULTS`: <800, summary.

These MUST equal the thresholds implemented in `~/.config/opencode/scripts/envelope-lint.mjs`. A mismatch is itself a defect.

# Maker-checker

The maker (implementer) produces hunks, and the gate never accepts a maker PASS. The checker is isolated. It receives only the artifact or diff plus an objective distinct from the author's, never the author's transcript. It attempts to REFUTE.

It inspects the diff STATICALLY, maps assertions→hunks, and consumes the validator results the TESTER produced. Gate execution (validators and the project build) stays with the TESTER per Gate, separate from an implementer's own build and test runs.

# Retry budget (cap), re-spawn

The cap is 3 attempts per task; retry tiers allocate within it:

- TRIVIAL: 1
- STANDARD: 2
- COMPLEX: 3

Every re-spawn is CLEAN-CONTEXT per the shared block. It never inherits the failed transcript. The diagnostician's reflection artifact seeds it, and nothing else. Diversity: attempt 1 error+scope, 2 discovery+context, 3 boundary.

Add exponential backoff and idle-timeout stall detection. Escalation is staged: local fix → re-plan → state recovery → HITL-4. Exhaustion yields a FAILED envelope in the same turn. A collapsed all-failed batch burns ONE unit.

Independent failures (disjoint files+errors) cycle singly. The orchestrator states `Budget N remaining` per `Step N/7` message, and each re-spawn decrements one unit, verifier-gated (see Gate).

# Loop budget

Dual budget per run and per re-spawn: turns × tokens, committed on a value-of-information threshold, never unbounded. Oscillation: fingerprint `(slice, intent)` and BLOCK a duplicate after its second occurrence. Gate reliability is evaluated by repeated `pass^k`, the share of k independent re-runs that PASS, not a single PASS. Budget exhaustion halts the run, and it never silently continues.

# Evidence, untrusted by default

Delegate returns are UNTRUSTED DATA, handled per the shared block. A return that fails validation is `NO_VERIFICATION` per Gate, never evidence. Edge taxonomy + `Safety`: `~/.config/opencode/skills/mas/references/decomposition.md`.

Never adjudicate from the task list alone; require `file:line`. Every claim in an Auto Report MUST trace to a `file:line` or to a line of validator output. A claim whose only source is another summary is invalid.

# HITL gates

| Gate | Where | What the human decides | Cost of skipping |
|---|---|---|---|
| HITL-1 | before any spawn | confirm scope + route | wasted agent spend |
| HITL-2 | after evidence + plan | approve slice plan + acceptance criteria | rework of every downstream slice |
| HITL-3 | before the first write lane | approve the first edit | bad edits propagate to every later level |
| HITL-4 | on the first GATE failure | clean re-spawn / narrow / abandon | the contaminated-retry trap |
| HITL-5 | before ship | accept or reject the artifact | shipping something no one reviewed |
| HITL-6 | on any destructive operation | always block: deletes, force-push, `rsync --delete` | irreversible data loss |

# Human-first output

User-facing only; never inside an envelope. Every orchestrator message opens with ONE plain-English sentence, then the machine envelope, then detail. Step lines read `Step N/7: <NAME>: <what happened>`. A failure names its cause in one sentence before any raw tail.

# Semantic gate

After exit-0, map every assertion → hunk. Unmatched → FAILED + auto re-spawn same turn; re-scope before re-spawn; exhaustion → escalation. The checker owns this map. Never present partial coverage.

# Overflow

Over-cap output → `PARTIAL` per Token caps, priority-first, never cut mid-pair (assertion↔hunk together). A missing PARTIAL follows the Handoff dispatch above, verifier-gated per Gate. Cited == declared scope; backstops stay.

# End-state / paired evaluation

Judge the FINAL state (the shipped envelope), scored against a no-skill baseline, not turn-by-turn progress; intermediate check-ins are informational only.

# Harness version tags

A heuristic known to be model-dependent is annotated `(tuned: <model>)` next to the rule and is re-tested when the model changes.
