# Cross-Agent Analysis of 4 Production Skills

Four independent agents analyzed four production skills and produced structured output contracts. This document compares their findings.

## The 4 Skills Analyzed

| Skill | Type | Key strength |
|---|---|---|
| `localterm` | Dense API reference | Playbook as procedural anchor; principle-first ordering |
| `dogfood` | Workflow phases | Numbered Phase N: Verb pattern; forward-referencing |
| `agent-self-evaluation` | Meta-cognitive rubric | Named anti-patterns; anti-herding in procedure; self-check |
| `autonomous-loops` | Pattern catalogue | Decision tree; comparison TOC; layered abstraction depth |

## Findings Shared Across All 4

| Finding | What it means for skill writing |
|---|---|
| Imperative titles outperform all others | "Required First Pass", "Playbook" — agent immediately knows what to DO |
| Anticipatory titles build trust | "The Traps You Will Hit" tells agent the section is for its benefit |
| "Overview" is the worst title | Every agent flagged it as content-free — signals nothing |
| Numbered sections create unambiguous order | `Phase N: Verb` lets the agent execute linearly without guessing sequence |
| Agent density target: ≤ 15% padding | Best skills had ~40-60% essential instruction, ~25-35% reference, ≤ 15% context |
| Anti-patterns are essential, not optional | What NOT to do is as valuable as what TO do. But they must be NAMED |
| Code blocks must be exact | Not "run the type checker" but `tsc --noEmit`. The agent copies verbatim |

## Unique Insights Per Skill

### From localterm: Principle-first ordering

State the principle first, then the concrete rule, then the example. The principle ("the tab stays open so the user sees the result") comes before the constraint ("never append exit"). This sequence teaches the model before constraining behavior.

### From dogfood: Forward-referencing

Tell the agent "you will reference this later." When collecting evidence, say "Save the screenshot_path — you will reference it in the report." This tells the agent what to retain in memory, critical for context-window management.

### From agent-self-evaluation: Anti-herding in procedure

Don't just warn against a bias — bake the correction into the procedure. "Do NOT average the scores in your head first. Score each axis fresh." This is stronger than "Avoid confirmation bias" because it replaces wrong behavior with a specific alternative.

### From agent-self-evaluation: Time-bounded thresholds

Give crisp decision rules with numbers. "If the gap is fixable in < 30 seconds, fix it now." Without the time bound, the agent has no way to decide whether to fix or escalate.

### From autonomous-loops: Decision trees over flat lists

When the agent must choose between options, give a yes/no branching tree. The tree mirrors how agents actually decide — by evaluating conditions sequentially.

```
Is the task simple?
├─ Yes → Use Sequential Pipeline
└─ No → Is there a written spec?
         ├─ Yes → Use Ralphinho
         └─ No → Use Continuous Claude
```

### From autonomous-loops: Comparison table as TOC

A comparison table at the top serves as both table of contents and decision matrix. The agent decides which section to read without reading the whole document.

## Ranked Title Patterns

| Rank | Pattern | Example | Agent response |
|---|---|---|---|
| 1 | Imperative | "Required First Pass", "Playbook" | Reads and executes immediately |
| 2 | Anticipatory | "The Traps You Will Hit" | Reads carefully — this is for its benefit |
| 3 | Named Diagnostic | "The Everything-Is-a-5 Trap" | Can self-check during execution |
| 4 | Core Assertion | "The Core Rule", "The Evidence Rule" | Reads once and internalizes |
| 5 | Comparative | "Good And Bad Patterns" | Pattern-matches against both sides |
| 6 | Reference | "Script Behavior You Must Know" | Consults when needed, skips during execution |

## What We Changed Based on This Analysis

| Finding | Applied change |
|---|---|
| "Playbook" > "Workflow" | Renamed procedural sections to use "Playbook" |
| Named anti-patterns | Each trap now has a memorable label |
| Decision tree | Added decision tree for technique selection |
| Self-check question | Added "Would the user agree?" to every checklist |
| Concrete trigger conditions | Replaced abstract criteria with specific tables |
| Comparison TOC | Added title-pattern guide table at top of reference |
