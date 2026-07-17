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
