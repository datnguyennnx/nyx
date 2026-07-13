---
name: effect-ts-principle-thinking
description: Core Effect mental models — Programs as Values, Edge of the World, Structured Concurrency, Contextual DI.
---

## Mental Models

| Model | Rule |
|---|---|
| Programs as Values | `Effect` = lazy description. Does nothing until Runtime executes it. |
| Edge of the World | `Effect.runPromise` / `NodeRuntime.runMain` ONLY at outer boundary. |
| Structured Concurrency | No orphaned fibers. All background tasks tied to `Scope` via `forkChild` or `forkDetach` within Layer. |
| Contextual DI | Dependencies via `Context.Service` + `Layer`. Never closures, singletons, globals. |
| Errors are Data | Expected failures in type signature (`Effect<A, E, R>`). Only unrecoverable = Defect. |
| Time via Clock | `Effect.Clock` + `Schedule`. Never `Date.now()`, `new Date()`, `setTimeout`. Wall-clock breaks referential transparency. |

## Anti-patterns (Mental Model Violations)

| Pattern | Detect | Severity |
|---|---|---|
| Mid-flight execution | `Effect.runPromise`/`runSync` in domain logic/services/mappers | HIGH |
| Per-request Layer provisioning | `Effect.provide(effect, AppLayer)` in hot path route handler — massive memory leak | HIGH |
| Wall-clock time | `Date.now()` / `new Date()` / `setTimeout` instead of `Clock`/`Effect.sleep` | HIGH |
| Orphaned background loops | `setInterval` / recursive `setTimeout` instead of `Effect.schedule` + `forkDetach` | HIGH |
| Swallowed error channel | `.catch()` on Promises without mapping to typed responses | HIGH |
| Closure state leaks | `let`/`const` outside Effect sharing state between fibers | MEDIUM |

## Preferred Patterns

| Pattern | Implementation |
|---|---|
| Entry points | `NodeRuntime.runMain` from `@effect/platform-node` (handles graceful SIGINT teardown) |
| Framework bridging | `ManagedRuntime.make(AppLayer)` once globally → `runtime.runPromise(effect)` in handlers |
| Access services | `Effect.services<R>()` |
| State management | `Ref` / `Ref.Synchronized` in `Context.Service` |
| Fiber-local state | `Context.Reference` in `References` module (`References.CurrentLogLevel`) |
| Resource lifecycles | `Effect.acquireRelease` → `Layer.effect` |
| Coordination | `Semaphore`, `Queue`, `Deferred` via Context |

## Severity

| Level | Criteria |
|---|---|
| HIGH | `runPromise` in handler + `.provide()` (memory leak), orphaned fibers, wall-clock time, APIs that won't compile |
| MEDIUM | Closure state instead of `Ref` (race conditions) |
| LOW | Suboptimal Layer usage where simple Context suffices |

## Output per finding
- Mental model violation (from table)
- Impact on supervision, DI, or performance
- Correct principle-aligned pattern
- Risk level

## Guardrails
- Focus on architecture and boundaries. Don't nitpick style if mental model is sound.
- `ManagedRuntime` is the correct framework bridging pattern — preserve it.
- When suggesting `ManagedRuntime`, specify global instantiation, not per-request.
- Ensure suggested changes respect external framework return types (e.g., MCP Promise requirements).
