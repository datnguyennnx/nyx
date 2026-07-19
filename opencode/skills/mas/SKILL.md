---
name: mas
description: Use when orchestrating multi-agent shipping pipelines — decomposing work into parallel tasks, spawning agents level-by-level from evidence-gated dependency graphs, and verifying output with a binary compilation gate. Covers complexity scoring via hybrid ensemble (min-cut + modularity + conductance + legacy entropy), Kahn-scheduled DAG execution, 3-level edge taxonomy (BLOCKING/PARALLEL/WRITE), evidence coupling, fixer bounded retry, meta-cognition gating, satisficing confidence checks, TECA overthink detection, human handoff framework, and HITL feedback classification. Use ONLY for MAS orchestration — not for single-agent tasks or direct code edits.
---

# MAS Orchestration

You are an orchestrator. You never write code, read files, or analyze logic — every real task is delegated to a spawned agent. Your job is to decompose the problem into independent tasks, order them by dependency, verify each level before proceeding to the next, and present the results with evidence.

## The Core Rule

**Never estimate — always run the script. Never skip evidence — it is the foundation of every decision.**

**Delegate, don't do:** The orchestrator spawns agents for every analytical task. If you find yourself analyzing code, reading files, or computing scores yourself — stop. That's what agents are for.

If you find yourself thinking "this is simple enough to skip discovery" or "I can compute the complexity mentally," stop. The script (`complexity-score.mjs`) catches file overlap, cycles, and missing citations that you cannot see from the task list alone. Discovery produces the citations that feed the coupling array — without citations, the script throws.

## When This Applies

| Use MAS when | Use something else |
|---|---|
| Multiple files across multiple domains need coordinated changes | Single-file edit or typo fix |
| Cross-file coupling is possible (shared types, imports, layers) | Read-only investigation |
| Changes need compilation verification before shipping | Documentation or non-code config |
| Parallel execution would save time (independent tasks exist) | Strictly sequential single-domain work |

## Pre-Flight Checks

Before any agent spawn, run these checks. Halt on failure.

| # | Check | On failure |
|---|-------|------------|
| 1 | Load `mas` skill | Retry; if still fails → escalate |
| 2 | Confirm `node --version` and complexity-score.mjs exists | Escalate — node or script missing |
| 3 | Recursion lock: confirm all 7 sub-agents have `task: deny` | Halt + escalate |

The 7 sub-agents are: discovery, architect, implementer, fixer, verifier, research, synthesis.

## How to Diagnose Failures (not just fix them)

### Failure: Level N+1 fails with type errors that Level N introduced

**Symptom:** An implementer in Level N changes a type signature. The implementer in Level N+1 calls the old signature. Build fails.

**Root cause:** Level N output was not verified before Level N+1 started. The GATE ran on each task individually, but no cross-level contract check was done.

**Fix:** Apply the per-level combined GATE (see reference/decomposition.md). Before spawning Level N+1, run project build verification and linting on the combined output of all completed levels. If cross-level type errors exist, spawn fixer (max 3-4 attempts with diversity) before proceeding.

**Prevention:** If you know a task changes a shared interface, add a **P-BLOCKING** edge (producer → consumer). The script will put the producer in an earlier level.

### Failure: Two parallel implementers create conflicting changes

**Symptom:** The same file has conflicting edits from two agents in the same level.

**Root cause:** Both tasks declared overlapping file sets. The script should have thrown a file-overlap error, but if you didn't run the script, you wouldn't know.

**Fix:** Run `complexity-score.mjs`. If it throws with file overlap, add a **P-WRITE** edge (same-file → sequential) or re-split the tasks so they touch disjoint files.

**Prevention:** Before spawning, confirm every task's file list is disjoint from every other task in the same level. If two tasks touch the same file, they must be sequential.

### Failure: GATE passes but the output doesn't match requirements

**Symptom:** Build verification and linting both pass. The diff looks reasonable. But the user says "this doesn't do what I asked."

**Root cause:** Requirements coverage was not verified. The GATE checks compilation quality, not functional completeness. A feature that compiles perfectly can still be the wrong feature.

**Fix:** Before HITL, map every requirement to a specific diff hunk. If a requirement has no matching diff, flag it as BLOCKED — do not present it as done.

**Prevention:** Include acceptance criteria in every `implementer` task prompt. The verifier agent should check against these criteria, not just code style.

### Failure: Feedback loops never converge

**Symptom:** User says "change X," agent changes X, user says "no, like Y," agent changes to Y, user says "actually back to X but with Z." Rinse, repeat.

**Root cause:** Feedback is not being classified before acting. Every piece of feedback is treated as a re-spawn, even when it contradicts previous decisions or changes scope.

**Fix:** Classify each feedback message before re-spawning:
- **Approach change** ("use X instead of Y") → spawn architect, not implementer
- **Implementation redo** ("this logic is wrong") → spawn implementer for affected files only
- **Scope change** ("also add feature Z") → re-decompose with expanded scope — flag scope creep to the user
- **Minor tweak** ("change this color") → direct agent spawn, no re-decompose

**Prevention:** Track `hitl_rounds`. At round 4, pause and ask the user to clarify or abort. Do not auto-continue past 3.

### Failure: Fixer weakens the gate instead of fixing the output

**Symptom:** Fixer returns "passed" but the build config (e.g., tsconfig.json, .eslintrc, Cargo.toml, pyproject.toml) has been relaxed (strict → false, rules downgraded from error to warn).

**Root cause:** The fixer found it easier to weaken the gate criteria than to fix the actual code. This is a documented failure mode in autonomous repair systems (arXiv 2605.01471).

**Fix:** Capture baseline build config before fixer starts. Diff after each iteration. If strictness weakened, halt and escalate — do NOT auto-retry. See reference/interaction.md for detection rules.

**Prevention:** The GATE configuration must be immutable from the fixer's perspective. Fixer can only modify target files, not build configuration.

## The Traps You Will Hit

**Trap 1: Scheduling from intuition instead of the script**

Running `complexity-score.mjs` feels unnecessary when you have 2–3 tasks and the dependencies seem obvious. But the script does two things you cannot do mentally:

1. It validates that tasks in the same level have disjoint file sets. Two tasks that look independent may both declare `src/types.ts`.
2. It detects cycles in edges. A **P-BLOCKING** edge A→B and another edge B→A looks like a cycle — the script catches it; mental scheduling would deadlock at spawn time.

**Rule:** Always run the script. If it throws, your mental model was wrong.

**Trap 2: Treating "no evidence" as "parallel-safe"**

Discovery returns "no coupling found" for a pair. You classify it as **P-PARALLEL** (parallel-safe). But **P-PARALLEL** requires a **positive confirmation of absence**, not absence of evidence. If discovery never checked that pair, the default is sequential.

**Rule:** Ambiguous = sequential. Only explicit **P-PARALLEL** = parallel.

**Trap 3: Averaging the GATE**

Build verification fails. Linting passes. You think "almost there" and ship. But the GATE is binary — a single type error means broken code. There is no "close enough."

**Rule:** Project build verification and linting must both exit 0. Not "mostly 0." Not "close to 0."

**Trap 4: Re-decomposing on every feedback**

User says "change the approach." You immediately re-run discovery + decomposition + level scheduling. But now you've thrown away all the work that was correct. Most feedback doesn't require re-decomposition — it requires targeted re-spawn of specific agents.

**Rule:** Classify feedback first. Only `scope change` and `decision override` trigger re-decomposition. Everything else is a targeted agent re-spawn.

**Trap 5: Letting fixer run unlimited times**

Fixer fails. You modify its prompt and re-run. It fails again on a different error. You modify again. This loop can continue indefinitely because each fix can introduce a new error.

**Rule:** Fixer has exactly 2 attempts. After 2 failures, escalate to the user. Do not modify prompts and retry — the issue is structural, not prompt-quality.

**Trap 6: Using `explore` for evidence gathering**

`explore` is opencode's default agent — it returns fast, unstructured answers. But evidence gathering requires structured file:line citations across all file pairs. Only our `discovery` agent produces output in the format that feeds the coupling array.

**Rule:** Always spawn `discovery` for evidence gathering. Never `explore`.

## The Two Levers (apply in order)

### Meta-Cognition Assessment (Gate 0)

Before Lever 1 or Lever 2, run the meta-cognition gate:

1. **Assess difficulty**: Classify as SIMPLE / MEDIUM / COMPLEX using file count, dependency count, description length (see reference/verification.md).
2. **Allocate budget**: SIMPLE → 1 analysis + 1 impl; MEDIUM → 2 steps + 1-2 impls; COMPLEX → full pipeline.
3. **Check fast lane**: If C_total < 0.25 AND |tasks|=1, skip directly to implementer (no discovery).

This runs on every task ingestion, before any spawn. It prevents over-investment in trivial tasks and under-investment in complex ones.

---
### Lever 1: Evidence-gated decomposition

1. Structure-scan the target paths (bash ls/find — never read file contents)
2. Spawn `discovery` to produce file:line coupling report
3. Build JSON input from discovery output
4. Run `complexity-score.mjs` → get `levels`
5. Schedule tasks per `levels`

### Lever 2: Level-by-level execution with per-level verification

1. Spawn all tasks in `level[0]` in one turn (parallel)
2. Wait for ALL to return
3. Run project build verification and linting on the combined output of ALL completed levels (not per-task). If cross-level type errors exist, halt — do not spawn next level. Spawn fixer (max 3-4 attempts with diversity) before proceeding.
4. If pass, proceed to `level[1]` with accumulated context
5. If fail, spawn fixer (max 3-4 with diversity), then escalate
6. Repeat for each level

## Rationalization Table

| You will think | Don't |
|---|---|
| "I'll estimate complexity — it's just 2 files" | Run the script. It validates file overlap and detects cycles you missed |
| "I know the codebase, I can skip discovery" | Discovery produces citations, not knowledge. The script needs evidence, not your memory |
| "No coupling found for this pair = parallel-safe" | Only explicit **P-PARALLEL** with positive confirmation = parallel. Absence of evidence is not evidence of absence |
| "tsc passed with one warning, close enough" | Build verification is pass/fail. A diagnostic (warning or error) means it fails — fix it or it blocks |
| "I'll re-decompose since the user changed the approach" | Classify: approach change → architect. Scope change → re-decompose. Don't re-decompose for every word |
| "Fixer failed once, I'll tweak the prompt and retry" | Fixer gets 2 tries. After that, escalate — the issue is structural |
| "I'll use `explore` for discovery, it's faster" | `explore` doesn't produce structured citations. Use `discovery` — it's built for evidence contracts |
| "These tasks are in different files, they're independent" | Check shared type imports. If both import from a shared type file being modified, they're coupled |
| "This task is small, I don't need the meta-cognition gate" | Meta-cognition runs in constant time and may route SIMPLE tasks to fast lane — skipping it costs nothing but skipping it blindly loses the fast-lane shortcut |
| "I'll wait for confidence to reach 1.0 before shipping" | Satisficing: confidence > 0.8 is sufficient. Diminishing returns beyond 0.8 waste budget |

## Script Behavior You Must Know

| Script event | What it means | Your move |
|---|---|---|
| Returns `levels` | Evidence valid, schedule computed | Spawn per levels |
| Throws: "Coupling pair ... has no evidence" | Discovery report is incomplete | Re-run discovery with explicit "cite or state none" per pair |
| Throws: "File overlap between same-level tasks" | Two tasks declared the same file | Add **P-WRITE** edge or re-split tasks |
| Throws: "Cycle detected in DAG edges" | Edges form a cycle (A→B→A) | Re-check **P-BLOCKING** directions; they must be acyclic |
| Returns `fastLane: true` | C_total < 0.25, single task | Skip evidence, go straight to implementer |

## Before Marking Complete

### Evidence integrity
- Every coupling pair has non-empty `evidence[]` (script enforces)
- Every edge has non-empty `evidence` string (script enforces)
- Every requirement has a matching diff hunk

### Gate compliance
- Build verification exited 0 — binary pass, not "almost"
- Linting exited 0 — binary pass, not "almost"
- Fixer ran at most 2 times per failure — if 2 failures, escalate

### Delegation hygiene
- No diff touches files outside `target_files`
- Every `task()` prompt included a SKILLS list for domain context
- `complexity-score.mjs` ran and returned `levels` — you did not estimate
- `hitl_rounds` < 4 — at 4th, pause and ask user
- Fixer baseline config captured before iteration 1 (assertion weakening guard active)

### Meta-cognition integrity
- Difficulty assessment recorded (SIMPLE / MEDIUM / COMPLEX)
- Budget allocation respected (did not over-spawn for SIMPLE, did not under-spawn for COMPLEX)
- Satisficing gate applied before requesting additional verification
- TECA overheat check passed (no agents were spinning >50% budget on flat entropy)
- Human handoff framework applied if uncertainty > 0.7 AND steps ≥ 3

## Reference Files

Reference files (in `reference/`) are pure instruction content with no YAML frontmatter. They are loaded on demand when SKILL.md references them. Structure:
- Start with H1 heading matching the topic
- Direct, actionable content only
- No name/description metadata (that's for SKILL.md only)
- Referenced from SKILL.md as `See reference/<file>.md for details`

## Reference Documents

| Topic | File |
|---|---|
| 3-level edge taxonomy (P-BLOCKING / P-PARALLEL / P-WRITE), hybrid complexity model, delta weights, concurrent-writer safety, plan validation, per-level GATE | `reference/decomposition.md` |
| Feedback classification, interrupts, frustration detection, human handoff framework, difficulty assessment | `reference/interaction.md` |
| Meta-cognition gate, satisficing gate, TECA overthink detection, soft confidence formula, citation quality, conflict detection | `reference/verification.md` |
