---
name: effect-ts-principle-thinking
description: Core Effect-TS v4 mental models — Programs as Values, Edge of the World, Structured Concurrency, Contextual DI.
---

## v4 Mental Model Changes

| v3 Concept | v4 Reality |
|---|---|
| `Runtime<R>` | REMOVED. Use `Effect.services<R>()` to access services. `Runtime.runFork(runtime)(program)` → `Effect.runForkWith(services)(program)` |
| `FiberRef` | REMOVED. Fiber-local state via `Context.Reference` in `References` module (e.g. `References.CurrentLogLevel`) |
| `Effect.Do` notation | DELETED. Must use `Effect.gen` |
| Cause (recursive tree) | FLAT. Iterate: `for (const reason of cause.reasons)` with `reason._tag "Fail" \| "Die" \| "Interrupt"` |

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
| v3 runtime usage | `Runtime<R>` type, `Runtime.runFork(runtime)(program)` | HIGH |
| v3 fiber state | `FiberRef` instead of `Context.Reference` | HIGH |
| v3 Do notation | `Effect.Do` + `Effect.bind` instead of `Effect.gen` | HIGH |
| Closure state leaks | `let`/`const` outside Effect sharing state between fibers | MEDIUM |

## Preferred Patterns (v4)

| Pattern | Implementation |
|---|---|
| Entry points | `NodeRuntime.runMain` from `@effect/platform-node` (handles graceful SIGINT teardown) |
| Framework bridging | `ManagedRuntime.make(AppLayer)` once globally → `runtime.runPromise(effect)` in handlers |
| Access services (v4) | `Effect.services<R>()` instead of `Effect.runtime<R>()` |
| State management | `Ref` / `Ref.Synchronized` in `Context.Service` |
| Fiber-local state (v4) | `Context.Reference` in `References` module (`References.CurrentLogLevel`) |
| Resource lifecycles | `Effect.acquireRelease` → `Layer.effect` |
| Coordination | `Semaphore`, `Queue`, `Deferred` via Context |

## Severity

| Level | Criteria |
|---|---|
| HIGH | `runPromise` in handler + `.provide()` (memory leak), orphaned fibers, wall-clock time, v3 APIs won't compile |
| MEDIUM | Closure state instead of `Ref` (race conditions) |
| LOW | Suboptimal Layer usage where simple Context suffices |

## Output per finding
- Mental model violation (from table)
- Impact on supervision, DI, or performance
- Correct v4 Principle-aligned pattern
- Risk level

## Guardrails
- Focus on architecture and boundaries. Don't nitpick style if mental model is sound.
- `ManagedRuntime` is STILL the correct framework bridging pattern in v4 — preserve it.
- When suggesting `ManagedRuntime`, specify global instantiation, not per-request.
- Ensure suggested changes respect external framework return types (e.g., MCP Promise requirements).
