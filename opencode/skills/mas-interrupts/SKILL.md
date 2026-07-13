---
name: mas-interrupts
description: Mid-session interrupt detection, classification, and frustration signal detection. Conceptual definitions for the ship-mas mode. Interrupt vs. new task distinction.
---

## Interrupt Classification

| Signal | Action |
|---|---|
| New request, system idle | Full routing: score → fast or full DAG |
| New request, manifest executing, score < τ | Halt current, stash state |
| New request, manifest executing, score ≥ τ | Inform user, queue after current |
| `!quick` prefix | Force Fast Lane regardless of score |
| `!stop` / `!cancel` | Abort pipeline, preserve stash |
| Frustration signal | Write-lock, route to clarification |

## Frustration Detection

ALL must hold across last 3 user messages: avg length < 15 tokens AND ≥2 of 3 contain negation keywords (EN: "no", "wrong", "stop", "not", "undo", "revert", "broken"; VI: "không", "sai", "dừng", "thôi", "hủy", "lỗi"). On detection: write-lock immediately — no file modifications until user provides new scope or `!continue`.

## Write-Lock Rules

ALLOWED: read-only discovery, clarification, state inspection. BLOCKED: `run_manifest` for file-modifying tasks. Lifts on: new scope description, `!continue`, `!rollback`. No auto-lift on timer.

## Interrupt vs New Task

User message references file/function/component in active manifest's `target_files` → INTERRUPT. Otherwise → NEW TASK. Default to NEW TASK when uncertain.
