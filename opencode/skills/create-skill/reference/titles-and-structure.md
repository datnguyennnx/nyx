---
name: create-skill-titles-structure
description: "Title strategy, skill anatomy, progressive disclosure, and information architecture for SKILL.md files."
---

# Title Patterns and Skill Anatomy

How to choose section titles and structure a skill for maximum agent comprehension.

## Section Title Patterns

Choose a section title based on what the section does:

| Section job | Best title pattern | Example |
|---|---|---|
| Tell the agent what to do first | Imperative | "Required First Pass", "Before Marking Complete", "Playbook" |
| Warn about specific failures | Anticipatory | "The Traps You Will Hit", "The Eight Bugs", "Escape Hatches Closed" |
| Teach recognition of problems | Diagnostic | "How to Diagnose Failures", "Symptom & Detection" |
| State the fundamental idea | Core Assertion | "The Core Rule", "The Two Levers", "The Evidence Rule" |
| Contrast two approaches | Comparative | "Good And Bad Patterns", "When This Applies" |
| Provide dense structured data | Reference | "Script Behavior You Must Know", "Key Configuration" |

### Titles to avoid

| Title | Why agents skip it | Replace with |
|---|---|---|
| "Overview" | No actionable signal | "Required First Pass" or "When This Applies" |
| "Introduction" | Agent can't determine relevance | "The Core Rule" or "Architecture" |
| "Details" | Agent can't decide if it needs it | "The Specific Trap: [name]" |
| "Conclusion" | Wastes context — skill already loaded | (Remove entirely) |
| "Tips" | Colloquial, agent doesn't know priority | "Diagnosis Patterns" or "Troubleshooting" |
| "Notes" | Not clear if important or trivial | "High-Value Checks" or "Verification Rules" |

### Multi-section naming

When multiple sections are at the same level, use consistent grammatical form:
- All imperative: "Required First Pass" → "Before Marking Complete" → "Apply the Fix"
- All diagnostic: "The Traps You Will Hit" → "How to Diagnose Failures" → "Symptom Detection"
- All anticipatory: "The Eight Bugs" → "Escape Hatches Closed"

Do NOT mix forms. Consistency tells the agent the sections are structural peers.

## Anatomy of a Skill

A skill has four structural layers:

```
Layer 1: Trigger      (frontmatter — when to load the skill)
Layer 2: Model        (core concept — one sentence that explains the domain)
Layer 3: Diagnosis    (traps, failures, symptoms — what goes wrong)
Layer 4: Verification (checklist — how to know you're done)
```

### Layer 1: Trigger (frontmatter)

The `description` field is the ONLY thing the agent sees before deciding to load. A bad description means the skill loads at the wrong time (wastes context) or never loads (wasted expertise).

Format:
```
Use when [specific trigger condition]. Covers [3-5 key topics]. Use ONLY when [scope gate].
```

### Layer 2: Model (core concept)

The first content section. Captures the entire domain in one sentence. If the agent understands only this sentence, it should be 60% toward a correct solution. This is the hardest sentence to write in the entire skill.

### Layer 3: Diagnosis (traps)

The bulk of the skill (60%+ of content). Contains traps, failure patterns, rationalization tables, and diagnostic guidance. This is where expertise lives.

### Layer 4: Verification (checklist)

Binary items only. Every item must be pass/fail with no interpretation needed. The agent runs through this before declaring done.

### Reference Files: With Frontmatter for Independent Loading

Reference files (in the `references/` folder) are loaded on demand when SKILL.md references them. Following 2026 best practices, each reference file now includes YAML frontmatter with `name` and `description` for independent discovery and loading via `skill()`. Structure:
- YAML frontmatter with `name` (required) and `description` (required)
- H1 heading matching the file's topic
- Direct, actionable content only
- Referenced explicitly from SKILL.md: `See reference/<file>.md for details`
- Max 1 level deep from SKILL.md (flat reference tree)

## Information Architecture

### Temporal ordering

Information that the agent uses first should come first in the skill:
1. Prerequisites / setup (first)
2. The core procedure (middle, largest)
3. Reference data (end, consulted on demand)
4. Troubleshooting / edge cases (end, consulted on failure)

### Depth monotonicity

The most important section should be the deepest. Each subsequent section should be optionally skimmable. If a skill has 5 sections and the last 3 are all equally critical, restructure so critical content is front-loaded.

### Nesting depth

Max 3 levels of heading nesting (`# → ## → ###`). Deeper nesting increases the chance the agent misparses the hierarchy. If you need more depth, split into a separate reference file.

## Progressive Disclosure (Tiered Loading)

From agentskills.io specification (2026 standard):

**Tier 1 — Metadata (always loaded, ~100 tokens)**
- `name` field: max 64 chars, lowercase-hyphens, must match directory name
- `description` field: max 1024 chars, third person, state WHAT and WHEN

**Tier 2 — Body (loaded on trigger, <5000 tokens)**
- SKILL.md body with core instructions, traps, checklists
- Hard cap at 500 lines

**Tier 3 — Resources (loaded on demand, zero tokens until accessed)**
- `references/` directory: deep documentation, policies, SOPs
- `scripts/` directory: executable code
- `assets/` directory: templates, static files

Keep the reference tree flat — all references should be one hop from SKILL.md. Deep nesting causes partial reads (Claude docs: agents may only `head -100` deep files).
