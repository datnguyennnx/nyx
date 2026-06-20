---
name: mas-feedback
description: HITL feedback classification, re-entry routing, loop guardrails with geometric decay
model. Loaded by all ship orchestrators.
---

## Feedback Classification

| Pattern | Re-entry Point | Example |
|---|---|---|
| Approach change | architect | "Use Queue instead of Semaphore" |
| Scope change | discovery → architect | "Also check file Z" |
| Implementation redo | implementer → review | "This looks wrong, redo it" |
| Decision override | re-aggregate | "That decision is wrong" |
| Verification add | implementer → review | "Add tests for edge case X" |
| Architecture redesign | architect → implementer → review | "I disagree with the architecture" |
| Feature add | discovery → architect → implementer → review | "Add validation for X" |
| Direction change | Full restart | "Take a different approach" |

## Loop Guardrails

### Geometric Decay Model

```
δ_n = δ_0 · r^n     r ∈ [0.3, 0.7]
Δ_n = δ_0 · (1 - r^{n+1}) / (1 - r)
```

n_max = 3 derived from δ₄ < 0.07·δ₀ at median r = 0.5.

| Guardrail | Rule | Justification |
|---|---|---|
| Max iterations | 3 loops. At 4th: pause, ask user. | δ₄ < 0.07·δ₀ — below noise floor |
| Preserve history | Reference prior outputs in re-aggregation | Enables Δ_n tracking |
| Scope creep flag | Flag if scope expands | Resets δ₀, invalidates model |
| No silent auto-loop | Present plan, wait for confirmation | HITL is convergence check |
| Stale context | >5 subagents → warn fragmentation | Increases r, undermines model |

## HITL Confirmation Format

```
### HITL — Re-Entry Confirmation
- Feedback: [pattern]
- Re-entry: [stage]
- Re-spawn: [agents]
- Changes: [summary]
- STATUS: AWAITING CONFIRMATION
```
