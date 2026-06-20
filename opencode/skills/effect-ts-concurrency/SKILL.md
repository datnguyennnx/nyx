---
name: effect-ts-concurrency
description: Concurrent operations in Effect-TS v4 — fiber management, interruption handling, bounded parallelism using Effect primitives.
---

## v4 Renames

| v3 | v4 |
|---|---|
| `fork` | `forkChild` |
| `forkDaemon` | `forkDetach` |
| `forkAll` | DELETED → use `Effect.forEach` with `forkChild` per element |
| `forkWithErrorHandler` | DELETED |

## Core Principles

- Concurrency must be intentional and bounded to prevent resource exhaustion
- Fibers are lightweight but not free — avoid unbounded creation
- Interruption must be handled properly for resource safety (finalizers must run)
- Choose coordination primitives based on actual coordination needs — don't over-coordinate
- Prefer collection concurrency (`Effect.forEach`) with bounds over manual fork management
- `Semaphore` for resource limiting, `Queue` for producer/consumer with backpressure
- `Deferred` for one-time synchronization between fibers, `Ref` for coordinated state updates
- Proper error propagation in concurrent contexts — don't swallow errors from fibers

## Preferred Primitives (v4)

| Primitive | Use for |
|---|---|
| `Effect.forEach` + concurrency | Bounded parallelism over collections (replaces deleted `forkAll`) |
| `Effect.forkChild` | Supervised child fiber — tied to parent Scope |
| `Effect.forkDetach` | Detached fiber with explicit supervision strategy |
| `Semaphore` | Resource limiting (DB connections, file handles) |
| `Queue` (bounded/sliding) | Producer/consumer with backpressure |
| `Deferred` | One-time synchronization between fibers |
| `Ref` + atomic ops | Shared state with `Effect.update` / `Effect.modify` |
| `Effect.race` + cancellation | Competitive execution with loser cleanup |
| `Effect.addFinalizer` / `ensure` | Resource cleanup on fiber interruption |
| `Effect.scoped` | Deterministic cleanup for concurrent resources |

## Anti-patterns

| Pattern | Detect | Severity |
|---|---|---|
| v3 API usage | `fork`, `forkDaemon`, `forkAll`, `forkWithErrorHandler` | HIGH |
| Unbounded concurrency | Many fibers without Semaphore or concurrency limits | HIGH |
| Ignoring interruption | No finalizers/cleanup on fiber interruption | HIGH |
| Lost updates | Concurrent Ref modification without atomic ops (`Effect.update`/`modify`) | HIGH |
| Fire-and-forget | `Effect.forkDetach` without supervision or error handling | HIGH |
| Missing error propagation | Concurrent ops swallowing errors | HIGH |
| Blocking in fibers | Sync blocking calls preventing fiber yielding | HIGH |
| Unbounded Queues | `Queue.unbounded` without backpressure consideration | MEDIUM |
| Race conditions | Check-then-act on shared state without atomic ops | MEDIUM |
| Misusing primitives | Queue for simple state sharing (use Ref), Deferred for repeated signaling (use Queue) | LOW |
| Over-coordination | Semaphore/Queue when simple parallelism with bounds suffices | LOW |

## Severity

| Level | Criteria |
|---|---|
| HIGH | Resource exhaustion, memory leak, deadlock, data corruption, v3 API won't compile |
| MEDIUM | Degradation under load, stuck fibers, potential race conditions |
| LOW | Over-coordination, suboptimal primitive choice — correct but not idiomatic |

## Output per finding
- File:line location
- Concurrency issue (from table)
- Recommended bounded/safe alternative with v4 API
- Risk level

## Guardrails
- Never remove interruption handling or finalizers.
- Preserve original concurrency semantics when bounding.
- Avoid coordination primitives where simple bounded parallelism suffices.
- Do not eliminate necessary concurrency — bound and supervise instead.
