---
name: effect-ts-concurrency
description: Concurrent operations — fiber management, interruption handling, bounded parallelism. Concern-specific add-on.
---

## Principles

- Concurrency must be intentional and bounded.
- Fibers are lightweight but not free — avoid unbounded creation.
- Interruption must handle finalizers properly.
- Prefer collection concurrency (`Effect.forEach`) with bounds over manual fork.

## Preferred Primitives

| Primitive | Use for |
|---|---|
| `Effect.forEach` + concurrency | Bounded parallelism over collections |
| `Effect.forkChild` | Supervised child fiber (tied to parent Scope) |
| `Effect.forkDetach` | Detached fiber with explicit supervision |
| `Semaphore` | Resource limiting |
| `Queue` (bounded/sliding) | Producer/consumer with backpressure |
| `Deferred` | One-time fiber sync |
| `Ref` + atomic ops | Shared state via `update`/`modify` |
| `Effect.race` + cancellation | Competitive execution with loser cleanup |
| `Effect.addFinalizer` / `ensure` | Cleanup on fiber interruption |
| `Effect.scoped` | Deterministic concurrent resource cleanup |

## Anti-Patterns

| Pattern | Severity |
|---|---|
| Unbounded concurrency (no Semaphore/limits) | HIGH |
| Ignoring interruption (no finalizers) | HIGH |
| Lost updates (non-atomic Ref modification) | HIGH |
| Fire-and-forget (`forkDetach` without supervision) | HIGH |
| Missing error propagation | HIGH |
| Blocking in fibers (sync calls preventing yield) | HIGH |
| Unbounded Queues (no backpressure) | MEDIUM |
| Race conditions (check-then-act without atomic ops) | MEDIUM |
| Over-coordination (Queue/Ref when bounded forEach suffices) | LOW |

## Guardrails

- Never remove interruption handling or finalizers.
- Bound concurrency — don't eliminate it.
- Avoid coordination primitives where bounded parallelism suffices.
