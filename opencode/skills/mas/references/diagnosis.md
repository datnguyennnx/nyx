# How to Diagnose Failures (not just fix them)

## Auto-Cycle Rule (retry-next-cycle)

Every failure re-enters the pipeline automatically — never halt mid-loop.
Sequence: (1) a **diagnostician** spawns with fresh context (zero parent history —
the subagent() prompt is its entire world) to root-cause the failure; (2) the
failing level re-spawns with the diagnosis + corrected instructions per the
Re-spawn Diversity Strategy (interaction.md § Re-spawn Diversity
Strategy); (3) the binary GATE re-runs. Each cycle consumes one verifier-gated
retry budget unit (default 3 per failure, tier-scaled — verification.md
§ Retry Budget). The ONLY halts are **auto-escalation boundaries** (retry budget
exhaustion, iteration budget exhaustion) and the **all-failed-batch stop** (§
Failure below) — those hand off structurally with state restored and a
fresh-context next cycle, never a bare pause. GATE configs are immutable:
fixing output, never relaxing criteria.

## Diagnostician Output Envelope (bounded diagnosis — default shape)

Diagnoses are BOUNDED envelopes, never free-form prose. Raw data rides along
ONLY when the re-spawn needs it to act.
```json
{"root_cause":"<one sentence, file:line>","fix":"<re-spawn instruction delta ≤120 words>","prevention":"<one line>","evidence":["<file paths>"],"raw_attached":true}
```
- `fix` is the ENTIRE delta the re-spawned implementer needs — the re-spawn prompt never re-reads the parent history.
- `evidence` lists files, not contents. Attach raw content only when `raw_attached:true` — i.e., the fix requires the exact error tail or a code region (verification.md § Failures Envelope) that a search-before-read window cannot re-derive.
- One envelope per failure OR per collapsed batch (§ All-Failed-Batch Stop). Never one envelope per error line.
- `tokens_saved` summary-field logging rule: verification.md § Envelope Rules (canonical).

## Search-Before-Read Windows

- Investigate with grep/glob BEFORE opening files. A file is read only after a search names both the file and the region.
- Initial read window ≤ 100 lines around the search hit; widen only if the window's contents demand it.
- Full-file dumps are exceptional and belong inside a Failures/Diagnosis envelope as `raw_attached:true` evidence — they are never routine discovery.
- Cross-level contract checks (per-level combined GATE) use per-level envelopes, not re-reading every completed diff.

## Failure: Level N+1 fails with type errors that Level N introduced

**Symptom:** An implementer in Level N changes a type signature. The implementer in Level N+1 calls the old signature. Build fails.

**Root cause:** Level N output was not verified before Level N+1 started. The GATE ran on each task individually, but no cross-level contract check was done.

**Fix:** Apply the per-level combined GATE (decomposition.md § Per-Level Combined GATE): before spawning Level N+1, run project build verification and linting on the combined output of all completed levels. If cross-level type errors exist, auto-cycle per the Auto-Cycle Rule above — spawn a **diagnostician** to isolate the contract break (which type changed, which consumer drifted), returned as one envelope naming the changed signature vs. the drifted call site (file:line on both sides).

**Prevention:** If you know a task changes a shared interface, add a **P-BLOCKING** edge (producer → consumer). The script will put the producer in an earlier level.

## Failure: Two parallel implementers create conflicting changes

**Symptom:** The same file has conflicting edits from two agents in the same level.

**Root cause:** Both tasks declared overlapping file sets. The script should have thrown a file-overlap error, but if you didn't run the script, you wouldn't know.

**Fix:** Run `complexity-score.mjs`. If it throws with file overlap, add a **P-WRITE** edge (same-file → sequential) or re-split the tasks so they touch disjoint files. Envelope the conflict as one entry (overlapping file + both task IDs); do not diagnose each conflicting hunk separately.

**Prevention:** Before spawning, confirm every task's file list is disjoint from every other task in the same level. If two tasks touch the same file, they must be sequential.

## Failure: GATE passes but the output doesn't match requirements

**Symptom:** Build verification and linting both pass. The diff looks reasonable. But the user says "this doesn't do what I asked."

**Root cause:** Requirements coverage was not verified. The GATE checks compilation quality, not functional completeness. A feature that compiles perfectly can still be the wrong feature.

**Fix:** Map every requirement to a specific diff hunk before HITL (Coverage Envelope, verification.md § Coverage Envelope). Flag any requirement with no matching diff as BLOCKED and enqueue it in the **auto retry queue** (fresh re-spawns per the Auto-Cycle Rule, with the unmatched requirements as the entire scope). The queue drains automatically before HITL — BLOCKED items cycle back through the pipeline instead of surfacing as incomplete work.

**Prevention:** Include acceptance criteria in every `implementer` task prompt. The orchestrator should check output against these criteria, not just code style.

## Failure: Feedback loops never converge

**Symptom:** User says "change X," agent changes X, user says "no, like Y," agent changes to Y, user says "actually back to X but with Z." Rinse, repeat.

**Root cause:** Feedback is not being classified before acting. Every piece of feedback is treated as a re-spawn, even when it contradicts previous decisions or changes scope.

**Fix:** Classify each feedback message against the canonical feedback classification table in
interaction.md (§ Feedback Classification), which covers 5 categories
including "Verification add" and "Decision override" that this earlier version omitted.
Apply the re-entry action specified in that table for each category.

**Prevention:** Track `hitl_rounds`. The iteration budget (default 3 per decision context; tier-scaled SIMPLE 1 / MEDIUM 3 / COMPLEX 5 / CROSS-CUTTING 5) **auto-stops** the loop at exhaustion — no mid-loop HITL pause, no explicit `!continue` signal required or permitted. Exhaustion is the auto-escalation boundary (structural escalation; interaction.md § Loop Guardrails). Classify every feedback message against the classification table BEFORE acting, so budget units are never burned on unclassified re-spawns.

## Failure: A whole batch fails with the same envelope signature

**Symptom:** Every implementer in a level returns a FAIL envelope, and the raw error tails share a common shape (same symbol, same import, same config error) across disjoint target files.

**Root cause:** The failures are NOT independent — the batch shares a hidden dependency or contract break (typically a Level N/upstream change), or a re-spawn relaxed a shared build config. Individual GATE runs on each task conceal the common cause; per-task re-spawning burns the whole batch's budget on a single root cause.

**Fix:** Apply the **all-failed-batch stop** (verification.md § All-Failed-Batch Stop): do NOT cycle each task individually. Collapse all FAIL envelopes sharing the signature into ONE diagnosis envelope (a single diagnostician spawn — search-before-read across the shared error tail first). The re-spawn scope is the collapsed batch as ONE RETRY-NEXT-CYCLE unit (registry entry), fix delta limited to the shared cause. Exception — only cycle individually when the file sets AND error tails are provably disjoint; prove it from the envelopes, never assume.

**Prevention:** Run the per-level combined GATE before spawning a level (cross-level contract check) and diff build config against the immutable baseline before every batch spawn — a shared failure signature is almost always upstream of the batch, not inside it.

## Failure: Re-spawn weakens the gate instead of fixing the output

**Symptom:** Re-spawn returns "passed" but the build config (e.g., tsconfig.json, .eslintrc, Cargo.toml, pyproject.toml) has been relaxed (strict → false, rules downgraded from error to warn).

**Root cause:** A re-spawn might weaken the gate criteria instead of fixing the actual code. This is a documented failure mode in autonomous repair systems.

**Fix:** Capture baseline build config before first implementer spawn; diff after each re-spawn. If strictness weakened, **auto strategy switch**: restore the config from the immutable baseline snapshot, then re-spawn a FRESH implementer per the Auto-Cycle Rule (the weakened attempt's history is discarded, never reused) with the diff of the weakened settings embedded as an explicit prohibition — as `raw_attached:true` in the diagnosis envelope. The switch changes the STRATEGY, never the criteria: the restored config is re-diffed before re-running the GATE, and any further weakening is an immediate auto-escalation boundary. See interaction.md (§ Assertion Weakening Detection) for detection rules.

**Prevention:** The GATE configuration must be immutable from the implementer's perspective. Implementer can only modify target files, not build configuration.

## Failure: Overthinking causes wrong output despite correct initial approach

**Symptom:** The orchestrator spends excessive tokens in thinking blocks (exceeding the tier budget by 50%+), oscillates between two valid approaches, and produces lower-quality output than a faster decision would have. Common in complex decomposition and cross-crate refactoring tasks.

**Root cause:** Insufficient delegation. The orchestrator tries to resolve ambiguity internally instead of spawning a discoverer or researcher to gather evidence. Research (Zhou et al. 2026, arXiv 2604.10739) shows that beyond a task-dependent threshold (typically 7K-12K tokens), marginal utility of additional thinking becomes negative. Answer oscillation is the strongest predictor (r=0.78).

**Fix:** Apply the oscillation-marker enforcement and TECA overthink detection rules from
verification.md (§ Oscillation Detection, § TECA Overthink Detection) instead of relying on hard token caps. The canonical detection thresholds and escalation rules are defined in the TECA section.