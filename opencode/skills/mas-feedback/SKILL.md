---
name: mas-feedback
description: Human-in-the-loop feedback handling. Classifies user feedback, determines pipeline re-entry points, and enforces feedback loop guardrails. Loaded by all ship orchestrator agents.
---

# MAS Feedback Re-Entry Protocol

This skill defines HOW an orchestrator handles human feedback and re-enters the pipeline at the correct point. It does NOT make ship decisions — that's `mas-decision`. It does NOT aggregate — that's `mas-aggregation`.

---

## Feedback Classification

When the user provides feedback, classify it into one of these patterns:

| Feedback Pattern | Re-entry Point | Example |
|---|---|---|
| **Approach change** | architect | "Use Queue instead of Semaphore" |
| **Scope change** | discovery → architect | "Also check file Z, this affects W too" |
| **Implementation redo** | implementer → review | "This looks wrong, redo it" |
| **Decision override** | orchestrator (re-aggregate) | "That decision is wrong, don't ship yet" |
| **Verification add** | implementer → review | "Add tests for edge case X" |
| **Architecture redesign** | architect → implementer → review | "I disagree with the architecture" |
| **Feature add** | discovery → architect → implementer → review | "Add validation for X as part of this" |
| **Direction change** | Full restart from user's new input | "Actually, let's take a different approach entirely" |

---

## Re-Entry Execution

```
1. User provides feedback
2. Orchestrator classifies feedback pattern (use table above)
3. Orchestrator determines re-entry point (from table)
4. Orchestrator formulates task for re-entry subagent(s)
5. Subagents execute from re-entry point
6. Orchestrator re-aggregates using mas-aggregation
7. Orchestrator re-evaluates using mas-decision
8. Orchestrator presents updated output to user
9. User confirms or provides more feedback
```

---

## Feedback Loop Guardrails

| Guardrail | Rule |
|---|---|
| **Max iterations** | 3 feedback loops per session. At 4th iteration, pause and ask: "We've iterated 3 times. Should I take a different approach?" |
| **Preserve history** | Keep previous iteration outputs. Reference them in re-aggregation as "Previous: [finding]. Updated: [new finding]." |
| **Scope creep flag** | If feedback expands scope significantly, flag: "This expands scope from [original scope] to [new scope]. Confirm before I proceed." |
| **No silent auto-loop** | NEVER auto-route back to implementer/architect without user awareness. Always present the action plan and wait for confirmation. |
| **Stale context warning** | If >5 subagents were spawned across iterations, warn: "Context may be fragmented. Recommend starting a fresh session for this iteration." |

---

## HITL Confirmation Format

Every re-entry decision must include:

```
### HITL — Re-Entry Confirmation
- Feedback classified as: [pattern from table]
- Re-entry point: [pipeline stage]
- Agents to re-spawn: [list]
- Changes from previous iteration: [summary]
- STATUS: [AWAITING USER CONFIRMATION]
```

---

## Integration

Load alongside `mas-aggregation` and `mas-decision` in every ship orchestrator. This skill handles feedback only.
