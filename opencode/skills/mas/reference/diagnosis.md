---
name: mas-diagnosis
description: "Diagnosis guide for common MAS orchestration failures: cross-level type errors, parallel implementer conflicts, GATE-pass mismatch, feedback loops, and re-spawn assertion weakening."
---

# How to Diagnose Failures (not just fix them)

## Failure: Level N+1 fails with type errors that Level N introduced

**Symptom:** An implementer in Level N changes a type signature. The implementer in Level N+1 calls the old signature. Build fails.

**Root cause:** Level N output was not verified before Level N+1 started. The GATE ran on each task individually, but no cross-level contract check was done.

**Fix:** Apply the per-level combined GATE (see reference/decomposition.md). Before spawning Level N+1, run project build verification and linting on the combined output of all completed levels. If cross-level type errors exist, re-spawn implementer with corrected instructions (max 3 attempts) before proceeding.

**Prevention:** If you know a task changes a shared interface, add a **P-BLOCKING** edge (producer → consumer). The script will put the producer in an earlier level.

## Failure: Two parallel implementers create conflicting changes

**Symptom:** The same file has conflicting edits from two agents in the same level.

**Root cause:** Both tasks declared overlapping file sets. The script should have thrown a file-overlap error, but if you didn't run the script, you wouldn't know.

**Fix:** Run `complexity-score.mjs`. If it throws with file overlap, add a **P-WRITE** edge (same-file → sequential) or re-split the tasks so they touch disjoint files.

**Prevention:** Before spawning, confirm every task's file list is disjoint from every other task in the same level. If two tasks touch the same file, they must be sequential.

## Failure: GATE passes but the output doesn't match requirements

**Symptom:** Build verification and linting both pass. The diff looks reasonable. But the user says "this doesn't do what I asked."

**Root cause:** Requirements coverage was not verified. The GATE checks compilation quality, not functional completeness. A feature that compiles perfectly can still be the wrong feature.

**Fix:** Before HITL, map every requirement to a specific diff hunk. If a requirement has no matching diff, flag it as BLOCKED — do not present it as done.

**Prevention:** Include acceptance criteria in every `implementer` task prompt. The orchestrator should check output against these criteria, not just code style.

## Failure: Feedback loops never converge

**Symptom:** User says "change X," agent changes X, user says "no, like Y," agent changes to Y, user says "actually back to X but with Z." Rinse, repeat.

**Root cause:** Feedback is not being classified before acting. Every piece of feedback is treated as a re-spawn, even when it contradicts previous decisions or changes scope.

**Fix:** Classify each feedback message before re-spawning:
- **Approach change** ("use X instead of Y") → orchestrator redesigns approach, then passes to implementer
- **Implementation redo** ("this logic is wrong") → spawn implementer for affected files only
- **Scope change** ("also add feature Z") → re-decompose with expanded scope — flag scope creep to the user
- **Minor tweak** ("change this color") → direct agent spawn, no re-decompose

**Prevention:** Track `hitl_rounds`. At round 4, pause and ask the user to clarify or abort. Do not auto-continue past 3.

## Failure: Re-spawn weakens the gate instead of fixing the output

**Symptom:** Re-spawn returns "passed" but the build config (e.g., tsconfig.json, .eslintrc, Cargo.toml, pyproject.toml) has been relaxed (strict → false, rules downgraded from error to warn).

**Root cause:** A re-spawn might weaken the gate criteria instead of fixing the actual code. This is a documented failure mode in autonomous repair systems (arXiv 2605.01471).

**Fix:** Capture baseline build config before first implementer spawn. Diff after each re-spawn. If strictness weakened, halt and escalate — do NOT auto-retry. See reference/interaction.md for detection rules.

**Prevention:** The GATE configuration must be immutable from the implementer's perspective. Implementer can only modify target files, not build configuration.
