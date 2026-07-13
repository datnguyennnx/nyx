---
name: mas-integrity
description: Citation quality function and anti-hallucination heuristics for LLM agent output validation. Conceptual definitions only — context dehydration and build/lint gating are handled by the TS Engine. Loaded by the task-decomposer and generic agents via injection.
---

## Citation Quality

`Q(c) = min(1.0, log₂(c + 1))` where c = cited_changes / total_changes.

| c | Q | Action |
|---|---|---|
| 0.00 | 0.00 | REJECT — no citations |
| 0.50 | 0.58 | MARGINAL — flag for review |
| 0.60 | 0.68 | ACCEPT — meets threshold (φ = 0.60) |
| 1.00 | 1.00 | FULL_TRUST |

## Anti-Hallucination Heuristics

| Indicator | Confidence | Action |
|---|---|---|
| No file:line citations | LOW | Flag ungrounded |
| All citations same line | LOW | Flag scope-limited |
| Citations reference files not in target_files | LOW | Flag out-of-scope |
| Formatted but vague content | LOW | Flag filler |
| Finding contradicts diff context | LOW | Flag conflict |
| Severity HIGH without concrete impact | MEDIUM | Downgrade |
| Direct file:line evidence for every claim | HIGH | Accept |

## Build/Lint Priority

Edge-judge hierarchy: 1) compiles? (`tsc --noEmit`) → if NO: BLOCKING. 2) passes lint? (`eslint`) → if NO: BLOCKING. 3) domain checks (anti-patterns, conventions) → if NO: NON_BLOCKING unless crash/data-loss/API-break. A change that compiles and passes lint ships. Domain violations are feedback, not gates.
