---
name: create-skill
description: "Use when writing or revising SKILL.md — structuring domain expertise into actionable, distilled instructions for AI agents. Covers eval-first development cycle (Anthropic), 14 skill authoring patterns (generativeprogrammer.com), trap-driven structure, progressive disclosure (agentskills.io spec), empirical validation (arXiv 2607.01456, SkillsBench), and skill retirement. Use ONLY when creating or editing a skill file — not for general code work, documentation, or non-skill content."
---

# Create Skill — Writing Skills

A skill encodes domain expertise so the reader (AI agent) can solve problems correctly without making mistakes you already made. A good skill teaches the domain model — not a checklist of steps.

This skill teaches how to write SKILL.md files for AI agents. The methodology is based on analysis of 238 production skills (arXiv 2607.01456), 14 authoring patterns from Anthropic's best practices, and the agentskills.io open specification.

## The Core Rule

**Traps over steps. Rationalization over instruction. Diagnosis over prescription. Evals over intuition.**

Bad skills say "do X, then Y, then Z." Good skills say "you will think X is right, but here's why it fails, how to detect it, and what to do instead."

The best skills are validated empirically — test prompts before body, baseline comparisons, hold-out validation sets, multi-trial runs. Research shows curated skills improve pass rates by 16.2 percentage points; self-generated skills show zero improvement (SkillsBench, Feb 2026).

## What This Covers

- **Eval-first development** — write tests before body, baseline comparison, hold-out validation
- **14 skill authoring patterns** — activation metadata, exclusion clause, progressive disclosure, control tuning, explain-the-why, and 9 more
- **Trap-driven structure** — how to encode expertise as actionable failure patterns
- **Progressive disclosure** — 3-tier loading: metadata, body, references (agentskills.io spec)
- **Empirical validation** — SNR, entropy, mutual information, multi-trial testing, retirement evals
- **Skill lifecycle** — draft → validated → production → retired, with retirement protocol

## Important: Read the Research Findings First

Before writing any skill, read `reference/traps-and-patterns.md` for:
- **14 patterns** covering activation metadata, exclusion clause, context budget, progressive disclosure, control tuning, explain-the-why, template scaffold, in-skill examples, known gotchas, execution checklist, self-correcting loop, plan-validate-execute, utility bundle, autonomy calibration
- **12 empirically-grounded anti-patterns** with fixes
- **Contradictions** across skill authoring sources (fat vs atomic, flat vs graph, MCP vs CLI)
- **Skill retirement** protocol and maturity model

## How to Use

1. Load `skill({ name: "create-skill" })` when writing or revising a skill
2. Read `reference/traps-and-patterns.md` for patterns and anti-patterns
3. Follow the Eval-First Development Cycle in `reference/process.md` — write test prompts BEFORE the body
4. Apply Progressive Disclosure from `reference/titles-and-structure.md` — keep SKILL.md under 500 lines
5. Validate with `reference/validation.md` — baseline comparison, hold-out sets, multi-trial
6. Gate the frontmatter last — description is the most important field
7. Plan for retirement — after 10 uses, run evals without the skill

## When This Applies

| Use this skill when | Use something else |
|---|---|
| You have 3+ specific failures you've hit in a domain | You're writing general documentation or a tutorial |
| You know the wrong intuitions agents will have | You're describing an API reference with no traps |
| You can name the specific mistake | You can only say "be careful" |
| The domain has concrete edge cases and failure modes | The task is straightforward with no ambiguity |
| You need a skill that will be used by others | You're writing a personal one-off script |

## Quick Checklist

Before submitting any skill:

1. **Eval-first**: Did you write test prompts (5 SHOULD, 5 SHOULD-NOT) before the body?
2. **Baseline comparison**: Did you run evals WITH and WITHOUT the skill? Is improvement > 10%?
3. **Hold-out set**: Did you set aside 40% of tests as validation set (never tuned against)?
4. **Multi-trial**: Did you run 3-5 trials per prompt? Does skill pass ≥ 3 of 5?
5. **Description gate**: Is it third person? Does it state WHAT and WHEN? Is there an exclusion clause?
6. **Progressive disclosure**: Is SKILL.md < 500 lines? Are references flat (1 hop)?
7. **Trap coverage**: Does every imperative have a corresponding trap?
8. **Retirement plan**: Do you know when to retire this skill?
9. **Empirical grounding**: Are your design decisions supported by evidence?
10. **Contradictions checked**: Have you considered the tradeoffs documented in `reference/traps-and-patterns.md`?

## Reference Documents

| Topic | File |
|---|---|
| Title patterns, section layers, skill anatomy, progressive disclosure | `reference/titles-and-structure.md` |
| **14 authoring patterns, 12 anti-patterns, contradictions, empirical citations, skill retirement, maturity model** | `reference/traps-and-patterns.md` |
| Eval-first validation, baseline comparison, hold-out sets, multi-trial, retirement eval | `reference/validation.md` |
| Tool mapping, permission patterns, context efficiency | `reference/tools.md` |
| **Eval-first 9-phase development cycle** (Anthropic + Anton Gulin methodology) | `reference/process.md` |
| Cross-agent analysis of production skills | `reference/cross-analysis.md` |

## Empirical Grounding

Key findings that inform this skill's methodology:

| Finding | Source | What it means for you |
|---|---|---|
| 99%+ of SKILL.md files contain ≥1 "skill smell" | arXiv 2607.01456 (238 skills) | Always validate — don't trust first draft |
| Curated skills: +16.2pp pass rate; self-generated: 0% improvement | SkillsBench (Feb 2026) | Invest in curation + iteration, not self-generation |
| 36% of public skills have prompt injection vulnerabilities | ToxicSkills, Snyk (2026) | Add security boundaries to production skills |
| Description tuning: ~50% trigger accuracy improvement | Atlan citing Google DeepMind | Spend dedicated effort on description optimization |
| Multi-trial: single-run results are noisy | Anthropic skill-creator | Run 3-5 trials per prompt configuration |
