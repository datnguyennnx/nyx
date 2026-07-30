---
name: create-skill-traps-patterns
description: "Trap writing (Symptom→Root Cause→Fix→Prevention), 14 authoring patterns, anti-patterns, contradictions, and skill maturity model."
---

# Trap Writing, Named Anti-Patterns, and Structural Patterns

How to encode expertise as actionable failure patterns, and how to structure sections for agent learning.

## How to Write a Trap

Each trap must follow this four-part structure:

```
Symptom:    What the agent observes (concrete)
Root cause: Why it happens (teaches the mental model)
Fix:        What to do now (actionable)
Prevention: How to avoid next time (systemic)
```

The root cause is the most important part — it transfers understanding so the agent can generalize beyond the specific case.

Each trap must begin with the specific wrong intuition the agent will have:

```
"You think X is correct, but Y happens because Z. Always do A instead."
```

Name the actual thought ("I'll estimate complexity — it's just 2 files"), not a generic category ("skipping steps is bad"). Named intuitions are retrievable during execution — the agent can catch itself thinking the wrong thing.

## Named Anti-Patterns

Anti-patterns are more effective when they have memorable labels. A named anti-pattern is retrievable during execution — the agent can think "am I doing the 'Everything-Is-a-5' thing right now?"

### How to name an anti-pattern

1. Identify the specific wrong behavior
2. Give it a short, descriptive label (3-7 words)
3. Use quotes or capitalization to mark it as a named thing
4. Provide a concrete example of the failure

### Examples of effective naming

| Anti-pattern label | What it catches |
|---|---|
| "Everything Is a 5" | Self-evaluation without citing evidence |
| "Scope-Creep Penalty" | Penalizing the output for things the user didn't ask for |
| "Negative-Instructions Cascade" | Adding "don't do X" that makes the agent hesitant about ALL testing |
| "Re-Litigation Trap" | Using evaluation to re-argue design decisions already made |
| "The Generic Warning" | "Be careful" instead of "You will accidentally X when Y" |
| "The Broad Gate" | Frontmatter description that matches everything so skill loads too often |

## Good And Bad Pattern Pairs

Presenting a "Bad" and "Good" version of the same scenario teaches through contrast. Rules:

- Both examples must be for the SAME task
- The bad example must show the WRONG intuition in action
- The good example must show the CORRECT response
- Explicitly label which is which

**Bad:** "Skipping evidence gathering is bad because you need citations."

**Good:** "You think 'I'll estimate complexity — it's just 2 files.' But the script detects file overlap and cycles you can't see mentally. Always run the script, never estimate."

**Bad:** A skill that starts with "Overview → Prerequisites → Inputs → Tools → Workflow → Tips"

**Good:** A skill that starts with "Playbook → Traps → Checklist → (reference at end)"

## Rationalization Table Pattern

Two-column table that names the specific wrong thought and replaces it with correct reasoning.

| Column | Content | Example |
|---|---|---|
| "You will think" | The specific wrong thought (not a generic category) | "I'll combine all changes into one agent call" |
| "Don't" | The correct reasoning + concrete alternative | "Split by file cluster. If two changes share a file, they must be sequential or use separate worktrees." |

Requirements:
- Each row names a REAL thought someone would have
- Each row gives a concrete alternative, not just "don't do that"
- 6-10 rows maximum — beyond that, prioritize the most common ones

## Decision Tree Pattern

When the agent must choose between approaches, use a decision tree instead of a flat list.

Format:
```
Is [condition true]?
├─ Yes → [action A]
└─ No → Is [second condition true]?
         ├─ Yes → [action B]
         └─ No → [action C]
```

Rules:
- Text-based ASCII indentation (not graphical)
- Each node is a single yes/no question
- Terminal leaves name a specific action or section
- Place the tree BEFORE the detailed sections

### When to use decision tree vs comparison table

| Use a decision tree | Use a comparison table |
|---|---|
| Choice is sequential (evaluate condition 1, then 2) | Choice is parallel (compare features side by side) |
| 3-6 terminal options | 2-4 options with many attributes |
| Decision logic is hierarchical | Decision logic is attribute-based |
| You want to guide step by step | You want the agent to browse and compare |

## The Playbook Pattern

The "Playbook" section is the single most effective structural element. It is a numbered list (8-15 items) of sequential steps the agent follows.

### What a Playbook is

- Each step is a SINGLE action — not a process description
- Steps are ordered BY DEPENDENCY — step N+1 assumes step N is complete
- Each step is SELF-CONTAINED — executable without consulting other sections

### Why Playbook beats Workflow

| Aspect | "Workflow" section | "Playbook" section |
|---|---|---|
| Agent reads as | "Here's how the process works" | "Here's what I must DO, in order" |
| Typical content | Descriptive paragraphs, options | Numbered imperatives, single actions |
| Follow-through | Partial — may skip steps | High — numbering creates obligation |
| Error recovery | Implicit or missing | "If X fails, do Y" built into steps |

### Playbook template

```
### Playbook

1. Health-check first. Do X before anything else.
2. Prefer Y over Z. Create, then verify.
3. After creating, do A so the user can confirm intent.
4. To verify, run B and poll until C.
5. Never do D without explicit confirmation.
6. If E happens, fall back to F.
7. When G is too complex, write a script.
8. For recurring tasks, use I instead of J.
```

## Checklist Pattern

Numbered items (8-12). Each item is BINARY — pass/fail with no interpretation needed.

Requirements:
- No subjective items ("review the output carefully")
- Concrete conditions ("confirm tsc --noEmit exited 0")
- Ordered by execution order or significance
- End with a self-check question: "Would the user agree with this assessment?"

## Table Pattern

Tables are for COMPARISON, not listing.

Good uses:
- Before/after contrasts
- Trap → Why → Fix mappings
- Tool → Use → Example mappings
- Condition → Action mappings

Bad uses:
- Two columns that don't contrast (name + description without comparison)
- 10+ rows of trivial data (that's a database, not a table)
- 1-2 rows with long cell content (prose would be clearer)

## Code Block Pattern

Code blocks are for EXACT commands — never for prose explanations.

Good: 
```
bash: node complexity-score.mjs --input '<json>'
```

Bad:
```
bash: run the complexity scoring script with your task data as JSON input
```

If the agent must type the command, give the exact command. If they need to understand a concept, use prose. Never mix the two in a code block.

## The 14 Skill Authoring Patterns (generativeprogrammer.com, 2026)

Based on analysis of Anthropic's skill authoring best practices and 238 production skills. Each pattern solves a specific design problem.

### Pattern 1: Activation Metadata
**Problem:** Agent doesn't load the skill when relevant.
**Solution:** The YAML description is the only signal at session start. Write in third person, state both WHAT and WHEN, include specific keywords.
**Source:** agentskills.io spec, Bibek Poudel (Medium)

### Pattern 2: Exclusion Clause (Ruben Hassid)
**Problem:** Skill hijacks unrelated requests.
**Solution:** "Do NOT use for X, Y, Z" in description is more important than the positive trigger. Negative cases are the most valuable test data.
**Source:** Ruben Hassid (X), Philipp Schmid (#3)

### Pattern 3: Context Budget
**Problem:** SKILL.md > 500 lines, wastes tokens on content never needed.
**Solution:** Hard cap at 500 lines / ~5000 tokens for the body. Offload deep content to references/.
**Source:** agentskills.io spec, Atlan, mdskills.ai

### Pattern 4: Progressive Disclosure
**Problem:** All content loaded at once — agent loses context for actual task.
**Solution:** Three tiers. Tier 1: metadata (~100 tokens, always). Tier 2: body (<500 lines, on trigger). Tier 3: references/ (on demand). Flat reference tree — one hop from SKILL.md.
**Source:** agentskills.io spec, Claude docs

### Pattern 5: Control Tuning (Philipp Schmid)
**Problem:** Instructions are too rigid or too vague.
**Solution:** Match instruction freedom to task fragility. Open field (text guidance) → preferred flows (pseudocode) → exact commands (fragile ops). "Describe what you want, not the path."
**Source:** philschmid.de/agent-skills-tips

### Pattern 6: Explain-the-Why (Anthropic)
**Problem:** Agent follows ALWAYS/NEVER literally, can't handle edge cases.
**Solution:** Reasoning beats bare imperatives. ALWAYS/NEVER/MUST is a "yellow flag" — the model generalizes better when it understands why.
**Source:** Anthropic skill-creator meta-skill (GitHub)

### Pattern 7: Template Scaffold
**Problem:** Agent spends tokens on structure instead of content.
**Solution:** Provide exact JSON/YAML output templates. The agent fills values instead of designing format.

### Pattern 8: In-Skill Examples
**Problem:** Agent misunderstands the abstraction.
**Solution:** 1-2 concrete examples per pattern. "Bad: ... Good: ..." pairs teach through contrast.

### Pattern 9: Known Gotchas
**Problem:** Agent hits edge cases the author anticipated.
**Solution:** Document specific failure modes as gotchas. "If X happens, check Y first."

### Pattern 10: Execution Checklist
**Problem:** Agent skips verification steps.
**Solution:** Binary checklist (pass/fail) at end of skill. Each item must be concrete, testable, ordered by execution.

### Pattern 11: Self-Correcting Loop
**Problem:** Agent makes a mistake and doesn't catch it.
**Solution:** After each action, verify the outcome. If unexpected, re-read context and re-attempt before escalating.

### Pattern 12: Plan-Validate-Execute
**Problem:** Destructive operations without verification.
**Solution:** For file-modifying operations: insert verifiable intermediate (JSON plan) between understanding and acting. Validate before side effects.

### Pattern 13: Utility Bundle
**Problem:** Repeated helper code across skills.
**Solution:** Deterministic logic → scripts/. Only output consumes context. If subagents write the same helper, bundle it.

### Pattern 14: Autonomy Calibration
**Problem:** Agent does too much or too little without asking.
**Solution:** Explicitly state when to ask user vs. proceed. "Never do X without confirmation" vs. "Proceed with Y, report result."

## Common Mistakes / Anti-patterns (Empirically Grounded, 2026)

Based on arXiv 2607.01456 (238 skills, 99%+ have skill smells) and practitioner consensus:

| # | Anti-pattern | Symptom | Fix |
|---|---|---|---|
| 1 | Vague Description | Agent never loads the skill | "Helps with documents" → "Extracts tables from PDF invoices and exports as CSV" |
| 2 | Over-Constraint | Agent can't recover from errors | Step-by-step → describe what you want (Philipp Schmid) |
| 3 | Context Bloat | SKILL.md > 500 lines | Split into reference files (agentskills.io spec) |
| 4 | No Exclusion Clause | Skill hijacks related requests | Add "Use ONLY when..." gate (Ruben Hassid) |
| 5 | No Data-Source Validation | Passes evals, wrong answer | Validate data freshness + source (Atlan) |
| 6 | Fiddly Overfitting | Passes 3 test prompts, fails on 4th | Hold out 40% as validation set (Anthropic skill-creator) |
| 7 | Deep Nesting | Agent misses content due to partial reads | Flat reference tree — max 1 hop from SKILL.md (Claude docs) |
| 8 | Time-Sensitive Instructions | Skills date themselves | "If before Aug 2025..." → remove, model knows current date (mdskills.ai) |
| 9 | First-Person Description | Agent confused about who's speaking | "I can help you..." → "Processes invoices and exports as CSV" |
| 10 | No Negative Test Cases | Only tests triggers, never non-triggers | Add 5 should-NOT-trigger tests per skill (Philipp Schmid) |
| 11 | No Retirement Plan | Running absorbed skill wastes context | Run evals without skill after N iterations; if pass, retire (Schmid #8) |
| 12 | Prompt Injection Vulnerable | 36% of public skills have injection risks | Add input sanitization, output boundaries (ToxicSkills, Snyk 2026) |

## Contradictions Across Sources

Skill authors disagree on several dimensions. Surface the contradictions so the agent can choose:

| Dimension | Approach A | Approach B | Resolution |
|---|---|---|---|
| Skill length | "3 sentences, 250K+ installs" (free_ai_guides) | "Fat skills with self-rewrite hooks" (Av1dlive) | Atomic trigger skills vs. procedural workhorses — different types |
| Flat vs Graph | "Flat file per capability" (agentskills.io) | "Skill Graphs > SKILL.md" (akshay_pachaar) | Graphs are organizational pattern on top of standard — compatible |
| MCP vs CLI | "MCP chews tokens" (Reddit) | "MCP delivers governed context" (Atlan) | MCP for governed data/auth; CLI for deterministic ops |
| Self-written skills | "Zero reliable improvement" (SkillsBench) | "Structured workflow works" (Anton Gulin) | SkillsBench tested without iteration loop — structured flow fixes this |
| Stateless vs Stateful | "Stateless first" (free_ai_guides, Schmid) | "4-layer memory" (Av1dlive) | Stateless for beginners; stateful for mature systems |

## Empirical Citations

Support skill design decisions with data:

| Finding | Source | Implication |
|---|---|---|
| 99%+ of SKILL.md files have ≥1 "skill smell" | arXiv 2607.01456 (238 skills) | Always validate — don't trust first draft |
| Curated skills: +16.2pp pass rate; self-generated: 0% improvement | SkillsBench (Feb 2026) | Invest in curation, not self-generation |
| 36% of public skills have prompt injection vulnerabilities | ToxicSkills, Snyk (2026) | Add security boundaries to production skills |
| Description tuning: ~50% trigger accuracy improvement | Atlan citing Philipp Schmid, Google DeepMind | Invest in description before body |

## Skill Retirement (Philipp Schmid #8)

After a skill has been used N times (default: 10), run your evals WITHOUT the skill loaded. If they pass, the model has absorbed the knowledge. Retire the skill to free context.

This is especially true for "capability skills" — as foundation models improve, what was once a skill becomes model knowledge. A skill explaining JSON syntax wastes context on a model that already knows it.

**Process:**
1. Track skill usage count
2. At N=10, run evals without skill
3. If pass → archive skill, remove from active config
4. If fail → keep, re-evaluate at N=20

## Skill Maturity Model (Atlan + arXiv)

| Stage | Characteristics | Validation |
|---|---|---|
| Draft | Raw traps, no structure, untested | Author review only |
| Validated | Eval-first, 80%+ trigger accuracy, 5+ test prompts | Automated evals pass |
| Production | <500 lines, progressive disclosure, exclusion clause | Gate + semantic check |
| Retired | Model absorbed knowledge, skill archived | Evals pass without skill |
