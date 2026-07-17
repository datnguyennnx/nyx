---
name: create-skill
description: Use when writing or revising SKILL.md — structuring domain expertise into actionable, distilled instructions for AI agents. Covers section title strategy, trap-driven structure, information-theoretic validation. Use ONLY when creating or editing a skill file — not for general code work or non-skill documentation.
---

# Create Skill — Writing Skills
A skill encodes domain expertise so the reader (AI agent) can solve problems correctly without making mistakes you already made. A good skill teaches the domain model — not a checklist of steps.

This skill teaches how to write SKILL.md files for AI agents. The methodology is based on analysis of 4 production skills and information-theoretic principles.

## The Core Rule

**Traps over steps. Rationalization over instruction. Diagnosis over prescription.**

Bad skills say "do X, then Y, then Z." Good skills say "you will think X is right, but here's why it fails, how to detect it, and what to do instead."

## What This Covers

- **Section titles** — which patterns work, which to avoid, and why
- **Skill anatomy** — the 4-layer structure (trigger, model, diagnosis, verification)
- **Trap writing** — how to encode expertise as actionable failure patterns
- **Information theory** — SNR, entropy, mutual information, and error-correcting codes applied to skill design
- **tools** — how skills map to read/edit/bash/task tools
- **Writing process** — 8-step iterative process from failure collection to cutting

## How to Use

1. Load `skill({ name: "create-skill" })` when writing or revising a skill
2. Start with the Quick Checklist below
3. Consult reference files for specific topics
4. Apply Information-Theoretic Validation (`reference/validation.md`) before submitting

## When This Applies

| Use this skill when | Use something else |
|---|---|
| You have 3+ specific failures you've hit in a domain | You're writing general documentation or a tutorial |
| You know the wrong intuitions agents will have | You're describing an API reference with no traps |
| You can name the specific mistake | You can only say "be careful" |
| The domain has concrete edge cases and failure modes | The task is straightforward with no ambiguity |

## Reference Documents

| Topic | File |
|---|---|
| Title patterns, section layers, skill anatomy | `reference/titles-and-structure.md` |
| Trap writing, named anti-patterns, good/bad patterns, decision trees, playbook | `reference/traps-and-patterns.md` |
| Information-theoretic validation (SNR, entropy, MI, error-correction) | `reference/validation.md` |
| tool mapping, sub-agent spawning, context efficiency | `reference/tools.md` |
| Writing process, knowledge aggregation, iteration cycle | `reference/process.md` |
| Cross-agent analysis of 4 production skills | `reference/cross-analysis.md` |

## Quick Checklist

Before submitting any skill:

1. Does every trap name the specific wrong intuition the agent will have?
2. Is every command exact — copy-pasteable into a terminal?
3. Is the frontmatter gated — "Use ONLY when" as important as "Use when"?
4. Does every imperative instruction have a corresponding diagnostic trap?
5. If you deleted 20% of the words, would meaning change? If no, cut more.
