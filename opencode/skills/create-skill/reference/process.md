# Writing Process, Knowledge Aggregation, and Iteration

How to go from raw experience to a finished skill, and how to keep it accurate over time.

## The 8-Step Writing Process

### Phase 1: Collect raw material

Write down every mistake you've made in this domain. For each:
- What did I think was correct?
- What actually broke?
- How did I detect it?
- What should I have done instead?

These become your traps. If you have fewer than 3 distinct failures, you don't have enough material for a skill yet.

### Phase 2: Find the core concept

In one sentence, what model does the reader need to understand?

Examples:
- "Hit area ≠ visual area" → interactive-hit-areas skill
- "Evidence is the foundation of the schedule" → MAS skill
- "Separate the behavior from the visual presentation" → de-sloppify pattern

If you can't say it in one sentence, you don't understand it well enough to teach it.

### Phase 3: Write the Playbook

Number the steps in execution order. Start with the health-check (what must the agent do first?). End with the verification (how does the agent know it's done?).

Each step is one action, not a process description. 8-15 steps total.

### Phase 4: Write the traps

For each mistake from Phase 1, write it as Symptom → Root Cause → Fix → Prevention.

Name the specific wrong intuition. "I'll just delete this token, no one uses it" — this is a real thought. "Skipping validation is bad" — this is forgettable.

### Phase 5: Add the decision tree

If the agent needs to choose between approaches, add a text-based decision tree before the detailed sections. Yes/no branches, terminal leaves name specific actions.

### Phase 6: Write the checklist

Binary items only. End with a self-check question: "Would the user agree with this assessment?"

### Phase 7: Gate the frontmatter

Write the `description` field last. It must:
1. Start with "Use when..." — names the trigger condition
2. List 3-5 key topics — gives the agent enough to match
3. End with "Use ONLY when..." — gates against irrelevant loading

### Phase 8: Cut

Every sentence must either teach a trap, state a rule, give an example, or verify completion. If it doesn't do one of these four things, delete it.

Run the compression test: can you delete 20% of the words without losing meaning? If yes, cut more.

## Knowledge Sources

Skills are not written from theory. Every piece of content should trace to a real source:

| Source | What it produces | Quality |
|---|---|---|
| Your repeated failures | Deep, specific traps | HIGHEST |
| Codebase archaeology | File patterns, shared types, layer boundaries | HIGH |
| Tool error messages | Script behavior tables | HIGH |
| User confusion patterns | Rationalization table rows | HIGH |
| Documentation reading | Scope boundaries, rules | MEDIUM |
| Research papers/articles | Validation of existing patterns | MEDIUM |
| Theory / first principles | Generic advice | LOW |

## The Iteration Cycle

Good skills are not written in one pass. They evolve:

```
Real failure occurs
  → Write the trap (specific scenario, not abstract)
  → Use the skill on the next task
  → Does the trap prevent the failure? If no, revise.
  → New failure occurs → add another trap
  → Old trap no longer relevant → remove or merge
  → Repeat
```

A skill with 3 deep, proven traps is better than a skill with 15 shallow, invented ones.

## What to Leave Out

- **Common sense** — if the agent already knows it, skip it
- **Steps that never fail** — if no one has done this step wrong, don't write it
- **Generic warnings** — "be careful" tells nothing. Replace with a specific trap
- **Corporate history** — "we decided on this approach in 2022" is context, not expertise

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
