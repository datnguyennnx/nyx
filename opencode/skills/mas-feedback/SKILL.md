---
name: mas-feedback
description: HITL feedback classification categories and loop guardrail model. Conceptual definitions for manifest re-entry routing. Loaded by the task-decomposer and ship-mas mode.
---

## Feedback Classification

| Pattern | Re-entry Phase | Example |
|---|---|---|
| Approach change | architect | "Use Queue instead of Semaphore" |
| Implementation redo | implement | "This looks wrong, redo it" |
| Verification add | verify | "Add tests for edge case X" |
| Architecture redesign | architect | "I disagree with the architecture" |
| Scope change / Feature add / Decision override / Direction change | redecompose | "Also check file Z" / "Add validation for X" / "That decision is wrong" / "Take a different approach" |

Maps to manifest's `hitl.reentry_routing`: key = category, value = `{ reenter_phase, target_node_strategy }`.

## Loop Guardrails

Max 3 feedback loops. At 4th: pause, ask user. Based on geometric decay: δ₄ < 0.07·δ₀ at median r=0.5 — below noise floor. Preserve history (reference prior outputs in re-entry). Flag scope creep (resets model). Always present plan, wait for confirmation — HITL is convergence check.
