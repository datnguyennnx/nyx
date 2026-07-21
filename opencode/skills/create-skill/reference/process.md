---
name: create-skill-process
description: "Eval-first development cycle (9 phases), iteration cycle, skill retirement protocol, and maturity model."
---

# Writing Process — Eval-First Development Cycle

The best skills are not written — they are grown through an eval-first iteration cycle. Research shows curated skills improve pass rates by 16.2 percentage points, while self-generated skills show zero improvement (SkillsBench, Feb 2026). The difference is the feedback loop.

## The Eval-First Development Cycle

### Phase 1: Intent Capture (replaces "Collect raw material")

Before writing anything, answer:
1. What specific task should this skill handle? (one sentence)
2. What are 3+ distinct failures you've experienced in this domain?
3. What would the agent do WRONG if you didn't write this skill?

Each failure becomes a trap. If you have < 3 failures, you don't have enough material.

### Phase 2: Write Test Prompts FIRST (Anthropic skill-creator methodology)

Write 10 test prompts BEFORE the skill body:
- 5 SHOULD trigger (tasks the skill is designed for)
- 5 SHOULD NOT trigger (related tasks the skill should NOT handle)

**Include negative test cases.** "Testing non-triggers is as important as testing triggers" (Philipp Schmid #3).

Hold out 40% of your test prompts as a validation set — don't tune against them.

### Phase 3: Draft the Skill Body

Write the minimal body that passes the test prompts:
1. **Trigger** — YAML frontmatter with name, description, exclusion clause
2. **Model** — Core concept in one sentence
3. **Diagnosis** — Traps with Symptom → Root Cause → Fix → Prevention
4. **Verification** — Binary checklist

Then immediately run the 5 SHOULD-trigger tests. Does the skill activate? Fix the description first — "most problems are in the trigger" (Bibek Poudel, referenced by 4+ sources).

### Phase 4: Run Baseline Evals (Anton Gulin opencode-skill-creator)

Run all 10 test prompts TWICE:
- Without the skill loaded (baseline)
- With the skill loaded

Measure:
- **Trigger accuracy**: Did the skill activate for SHOULD tests? Did it stay silent for SHOULD-NOT tests?
- **Output quality**: Did the output improve with the skill?
- **Token overhead**: How many tokens did the skill add?

If the skill adds < 10% quality improvement, reconsider whether it's needed.

### Phase 5: Iterate on Failures

For each test where the skill did NOT improve output:
1. Identify what the agent did wrong — is it a description problem (wrong trigger) or body problem (wrong instruction)?
2. Fix the most specific cause first — add a trap, not a general warning
3. Re-run the failed test
4. Re-run all previously passing tests (regression check)

**Warning:** If you only fix the 3 failing prompts, you will overfit to them. Hold-out validation set catches this.

### Phase 6: Description Optimization (Bibek Poudel)

After the body is stable, spend dedicated effort on the description:
1. Test 5 alternate descriptions against the same skill body
2. Measure trigger accuracy for each
3. Pick the one with highest SHOULD-trigger + lowest SHOULD-NOT-trigger rate

"Roughly 50% improvement in trigger accuracy from tuning description alone" (Atlan citing Google DeepMind).

Run 3-5 trials per prompt configuration (Anthropic recommendation) — single-trial results are noisy.

### Phase 7: Gate the Frontmatter

```
Use when [specific trigger condition]. Covers [3-5 key topics].
Use ONLY when [scope gate — what this skill should NOT do].
```

Format rules:
- Third person only ("Processes invoice PDFs" not "I can process invoices")
- Max 1024 characters (agentskills.io spec)
- Keywords the agent will match against user requests
- Exclusion clause at the end

### Phase 8: Progressive Disclosure Check

1. Is SKILL.md body < 500 lines? If no, split into references/
2. Are references flat (1 hop from SKILL.md)? If no, flatten
3. Does every paragraph carry signal (imperative/diagnostic/verification)? If no, cut
4. Can you delete 20% of words without losing meaning? If yes, cut more

### Phase 9: Install and Monitor (Anton Gulin)

Install the skill and monitor real usage:
- Track trigger rate — too high = description too broad; too low = description too narrow
- Track failure rate — high failure rate = skill needs iteration
- After 10 uses, run evals WITHOUT the skill (Philipp Schmid #8)
- If evals pass without skill → retire it (model absorbed the knowledge)

## The Iteration Cycle (Refined)

```
Real failure occurs
  → Write the trap (specific scenario, not abstract)
  → Write 2 test prompts for this trap (1 trigger, 1 non-trigger)
  → Run evals with AND without skill
  → Does the trap prevent the failure?
     ├─ Yes → Keep, monitor
     └─ No → Revise trap or add context
  → Re-run all prior tests (regression check)
  → New failure occurs → repeat
  → Old trap no longer relevant → archive
  → After 10 total uses → run retirement eval
```

## Skill Maturity Model

| Stage | Criteria | Gate |
|---|---|---|
| Draft | Raw traps, no structure, untested | Author review only |
| Validated | Eval-first: 80%+ trigger accuracy, 5+ test prompts, hold-out set passes | Automated evals pass |
| Production | < 500 lines, progressive disclosure, exclusion clause, all 14 patterns reviewed | Gate + semantic check |
| Retired | Evals pass without skill, archived | Retirement eval passes |

## Knowledge Sources (updated)

| Source | What it produces | Quality | Verification method |
|---|---|---|---|
| Your repeated failures | Deep, specific traps | HIGHEST | Cross-check with teammate |
| Codebase archaeology | File patterns, shared types | HIGH | Manual review |
| Tool error messages | Script behavior tables | HIGH | Copy-paste exact output |
| User confusion patterns | Rationalization table rows | HIGH | 3+ observations |
| Documentation reading | Scope boundaries, rules | MEDIUM | Test against real task |
| Research papers/articles | Validation of patterns | MEDIUM | Cite source in skill |
| Theory / first principles | Generic advice | LOW | Replace with specific trap |

## What to Leave Out (unchanged from original)

- **Common sense** — if the agent already knows it, skip it
- **Steps that never fail** — if no one has done this step wrong, don't write it
- **Generic warnings** — "be careful" tells nothing. Replace with a specific trap
- **Corporate history** — "we decided on this approach in 2022" is context, not expertise

## Skill Retirement Protocol (NEW)

**When to retire:**
After 10 documented uses, run your eval suite WITHOUT the skill loaded. If all tests pass, the model has absorbed the knowledge.

**Retirement process:**
1. Archive the skill file (move to `archive/` directory)
2. Remove from active config (opencode.json)
3. Document what was learned in a changelog
4. If the same failure reoccurs later, un-archive and iterate

**Why retire:**
- Every active skill consumes context budget
- Foundation models improve — what was once skill knowledge becomes model knowledge
- Running a skill that adds no value is negative ROI (wastes tokens, may conflict)

## Case Studies

### tailwind-token-consolidation

| Aspect | What it does |
|---|---|
| Core concept | "Reducing tokens while preserving visual fidelity" |
| Traps | 8 named bugs with scenario + root cause + fix |
| Structure | Levers → Bugs → Transformation → Loop → Rationalization → Checklist |
| Title strategy | "The Eight Bugs You Will Hit" (anticipatory), "The Two Reduction Levers" (core assertion) |
| Tool adoption | Exact `pnpm`, `rg`, `python3` commands |

### agent-self-evaluation

| Aspect | What it does |
|---|---|
| Core concept | "Self-rate on 5 axes with concrete evidence" |
| Traps | 4 named anti-patterns ("Everything Is a 5") |
| Structure | Trigger → Concepts → Workflow → Examples → Anti-Patterns → Best Practices |
| Title strategy | "The Evidence Rule" (core assertion), "When to Activate" (anticipatory), "Anti-Patterns" (diagnostic) |
| Key innovation | Anti-herding instruction baked into procedure ("Do NOT average scores first") |
