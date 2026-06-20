---
name: mas-interrupts
description: Mid-session interrupt detection, classification, and routing protocol.
Frustration signal detection, write-lock rules, interrupt vs. new task distinction.
Loaded by task-decomposer and task-coordinator.
---

## Interrupt Classification

| Signal | Classification | Action |
|---|---|---|
| New request, system idle | Normal task | Full routing: score → fast or full DAG |
| New request, DAG executing, score < τ | Fast interrupt | Halt & Stash (per `mas-session-state`) |
| New request, DAG executing, score ≥ τ | Queue interrupt | Inform user, queue after current task |
| `!quick` prefix | Explicit fast | Force Fast Lane regardless of score |
| `!stop` / `!cancel` | Explicit cancel | Abort pipeline, preserve stash |
| Frustration signal | Frustration | Write-lock. Route to clarification. |

## Frustration Signal Detection

ALL must hold across last 3 user messages:
- Average message length < 15 tokens
- ≥2 of 3 contain negation keywords:
  EN: "no", "wrong", "stop", "not", "undo", "revert", "broken"
  VI: "không", "sai", "dừng", "thôi", "hủy", "lỗi"

On detection: write-lock immediately.

## Write-Lock Rules

FORBIDDEN: `implement`, `fixer`, `ast-aggregator`, any file write.

ALLOWED: `discovery` (read-only), clarification responses.

Lifts on: new scope description (restart), `!continue` (resume), `!rollback` (restore checkpoint).

No auto-lift on timer.

## Interrupt vs. New Task

User message references any file/function/component in active DAG's `pending_nodes` or `completed_nodes` → INTERRUPT. Otherwise → NEW TASK.

Default to NEW TASK when uncertain.

## Signal Prefixes

| Prefix | Action |
|---|---|
| `!quick` | Force Fast Lane |
| `!stop` / `!cancel` | Abort pipeline, preserve stash |
| `!continue` | Lift write-lock, resume |
| `!rollback` | Restore last clean checkpoint |
