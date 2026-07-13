---
name: effect-ts-core
description: Foundational Effect-TS patterns — mental models, code conventions, anti-patterns, resource layers. Core skill for any Effect-TS work.
---

## Mental Models

| Model | Rule |
|---|---|
| Programs as Values | `Effect` = lazy description. Does nothing until Runtime runs it. |
| Edge of the World | `Effect.runPromise` / `NodeRuntime.runMain` ONLY at outer boundary. Never in domain logic. |
| Structured Concurrency | All fibers tied to `Scope` via `forkChild`. No orphaned fibers. |
| Contextual DI | Dependencies via `Context.Service` + `Layer`. Never closures, singletons, globals. |
| Errors are Data | Expected failures in type signature `Effect<A,E,R>`. Only unrecoverable = Defect. |
| Time via Clock | `Clock` + `Schedule`. Never `Date.now()`, `setTimeout`. |

## Style Rules

| Rule | Enforce |
|---|---|
| Service definition | `class Svc extends Context.Service<Svc, Shape>()("Svc") {}` |
| Pattern matching | `Match.type`/`Match.tag` over `if/else`/`switch`. Always `Match.exhaustive` on closed unions. |
| Effect.gen | For 3+ sequential effectful steps. One `yield*` per line. Single-screen blocks. |
| pipe | For 1-3 transformations. Never nest >3 levels. |
| No tacit | Always `Effect.map((x) => fn(x))`, never `Effect.map(fn)`. |
| Schema-first | `Schema.Struct` once. Derive type: `Schema.Type<typeof S>`. Never duplicate. |
| Naming | Service=PascalCase noun. Layer=`ServiceNameLayer`. Error=`Schema.TaggedErrorClass`. File=kebab-case. |
| No mid-flight execution | Never `Effect.runSync`/`runPromise` outside entry points. |
| Entry points | `NodeRuntime.runMain` from `@effect/platform-node`. |
| Forking | `forkChild` > `fork`. `forkDetach` > `forkDaemon`. |
| Fiber state | `Context.Reference` in `References` module (not `FiberRef`). |
| Runtime access | `Effect.services<R>()` (not `Runtime<R>`). |
| Schema decoding | `decodeUnknownEffect` / `decodeEffect`. |
| Unstable imports | HTTP, SQL, RPC under `effect/unstable/*`. |

## Module Structure

```
src/user/
  user-service.ts         # Tag + interface
  user-service-live.ts    # Layer implementation
  user-service-test.ts    # Test Layer
  user-errors.ts          # TaggedError types
  user-schema.ts          # Schema definitions
```
One concern per file. Exports: tag + shape together. Layer files export default + named layers.

## Resource Layer Patterns

| Pattern | Use |
|---|---|
| Safe acquisition | `Layer.effect(Tag, Effect.acquireRelease(acquire, release))` |
| Layer composition | `Layer.merge` (parallel), `Layer.provide` (sequential) |
| Localized lifetime | `Scope` when sharing not appropriate |
| Auto-memoization | Default. Opt-out: `Effect.provide(layer, { local: true })` |
| Framework bridging | `ManagedRuntime.make(AppLayer)` once globally, `runtime.runPromise(effect)` in handlers |

## Anti-Patterns (HIGH severity)

| Pattern | Severity |
|---|---|
| Promise-first code (await/.then inside Effect.gen without interop) | HIGH |
| Hidden service deps (concrete types in Requirements instead of Context tags) | HIGH |
| Module-level singleton (`const client = new Pool()` outside Layer) | HIGH |
| `any`/`as` casts erasing Effect's A/E/R channels | HIGH |
| Missing `Match.exhaustive` on known union | HIGH |
| Tacit function args (`Effect.map(fn)`) | HIGH |
| Duplicate Schema + manual type | HIGH |
| `Effect.runSync`/`runPromise` in production logic | HIGH |
| `@effect/platform` imports for unstable modules | HIGH |
| Wall-clock time (`Date.now()`/`new Date()` instead of `Clock`) | HIGH |
| Per-request `Effect.provide(effect, AppLayer)` in hot path | HIGH |
| Manual resource manage (open/close in service methods without Scope/Layer) | HIGH |

## Low/Medium Anti-Patterns

| Pattern | Severity |
|---|---|
| Oversized Effect.gen (validation+fetch+transform+persist+log mixed) | MEDIUM |
| Bad service def (Tag without shape interface) | MEDIUM |
| Nested pipe >3 levels | MEDIUM |
| Mixing Effect.gen + pipe in same expression | MEDIUM |
| `switch` on `_tag` instead of `Match.tag` | MEDIUM |
| Non-idempotent finalizers | MEDIUM |
| Business logic in Layer construction | MEDIUM |
| Generic file names (`types.ts`, `errors.ts`) | LOW |
| Layer where `Effect.succeed` suffices | LOW |

## Formatting

- Imports: `"effect"` first, `"@effect/*"` next, app modules last.
- Layer definitions: `Layer.effect(Tag, Effect.gen(...))` for resourceful. `Layer.succeed` for pure.
- Pipeline chains: one operation per line, indented.

## Guardrails

- Changes must not alter business logic or runtime behavior.
- Verify union is closed before recommending `Match.exhaustive`.
- Never remove resource cleanup or finalizers.
- Defer to existing project conventions unless they conflict with Effect patterns.
