---
name: effect-ts-resource-layer
description: Resource lifecycle and dependency graphs in Effect — Layer construction patterns with explicit acquisition and release semantics.
---

## Core Principles

- Layer is a constructor/composition abstraction for dependency graphs, not a place for business logic
- Resource lifetime and cleanup ownership must be explicit in the type system
- `Layer.effect` for effectful resource construction that may fail during acquisition
- `Layer.succeed` for pure values or already-created resources that need no cleanup
- Prefer scoped resource construction (`Layer.effect` with `Scope`) for localized lifetimes
- Avoid constructing resources outside Layer context (module scope, service methods)
- Ensure finalizers run even when errors occur during acquisition using `Effect.acquireRelease`
- Keep service interfaces independent of resource details by managing dependencies at Layer level

## Preferred Patterns

| Pattern | Implementation |
|---|---|
| Safe acquisition | `Layer.effect(Tag, Effect.acquireRelease(acquire, release))` |
| Layer composition | `Layer.merge` (parallel), `Layer.provide` (sequential) |
| Localized lifetime | `Scope` when Layer sharing not appropriate |
| Auto-memoization | Default across `Effect.provide` calls. Opt-out: `Effect.provide(layer, { local: true })` when per-request isolation needed |
| Service definition | `class Svc extends Context.Service<Svc, { readonly find: (id: string) => Effect<User, never, never> }>()("Svc") {}` |
| Framework bridging | `const runtime = ManagedRuntime.make(AppLayer)` once globally, then `runtime.runPromise(effect)` in route handlers |

## Anti-patterns

| Pattern | Detect | Severity |
|---|---|---|
| Manual resource mgmt | Direct open/close in service methods without Scope/Layer | HIGH |
| Module-level singletons | Resource construction at module scope outside Layer | HIGH |
| Missing release on failure | No release in acquireRelease when acquisition fails | HIGH |
| Non-idempotent finalizers | Cleanup that fails on double-release | HIGH |
| Implementation leakage | Service interface Requirements containing concrete types | MEDIUM |
| Resources in Effect.gen without scoping | Leaks from unscoped resource creation | MEDIUM |
| Business logic in Layer | Mixing orchestration with resource construction | MEDIUM |
| Per-request Layer provisioning | `Effect.provide(effect, AppLayer)` in hot path route handler | HIGH |
| Layer with simple value | `Layer` where `Effect.succeed` suffices | LOW |
| Mixed concerns in Layer | Config + logging + database in one Layer | LOW |

## Severity

| Level | Criteria |
|---|---|
| HIGH | Resource leak, double-release crash, missing cleanup on acquisition failure, per-request provisioning (memory leak) |
| MEDIUM | Hidden singleton outside Layer, missing Scope, non-idempotent finalizer |
| LOW | Layer where succeed suffices, unnecessary memoize, mixable concerns |

## Output per finding
- File:line location
- Resource management issue
- Recommended Layer/Scope pattern
- Risk level

## Guardrails
- Never remove resource cleanup without equivalent safe replacement.
- Avoid over-scoping shared resources — use auto-memoization (default).
- Per-request isolation: use `{ local: true }` when needed, not global memoization override.
- Don't suggest Layer for values that don't need lifecycle management.
- Prevent Layers that mix unrelated concerns — split by responsibility.
