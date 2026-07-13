---
name: effect-ts-code-conventions
description: Idiomatic Effect-TS coding style — pattern matching, Effect.gen, naming, module structure, Schema-first design, formatting.
---

## Style Rules

| Rule | Enforce |
|---|---|
| Service definition | `Context.Service` class syntax: `class Svc extends Context.Service<Svc, Shape>()("Svc") {}` |
| Pattern matching | `Match.type` / `Match.tag` over `if/else` / `switch`. Always `Match.exhaustive` on known unions. |
| Effect.gen | For 3+ sequential effectful steps. One `yield*` per line. Keep blocks single-screen. |
| pipe | For 1-3 transformations. Never nest >3 levels. |
| No tacit | Always `Effect.map((x) => fn(x))`, never `Effect.map(fn)`. Preserves generics and stack traces. |
| Schema-first | Define `Schema.Struct` once. Derive type: `Schema.Type<typeof S>`. Never duplicate. |
| Naming | Service = PascalCase noun. Layer = `ServiceNameLayer`. Error = `Schema.TaggedErrorClass`. File = kebab-case of primary export. |
| Branding | `Brand.nominal` for type distinction. `Brand.refined` for runtime validation. Not a general validation framework. |
| No mid-flight execution | Never `Effect.runSync`/`runPromise` in services/layers. Tests only. |
| Entry points | `NodeRuntime.runMain` from `@effect/platform-node`. Handles graceful SIGINT teardown. |
| Error handling | `catch` (not `catchAll`), `catchFilter` (not `catchSome`), `result` (not `either`). |
| Forking | `forkChild` (not `fork`), `forkDetach` (not `forkDaemon`). `forkAll` and `forkWithErrorHandler` do not exist — use `Effect.forEach` with `forkChild`. |
| Fiber state | `Context.Reference` in `References` module (not `FiberRef`). |
| Runtime access | `Effect.services<R>()` (not `Runtime<R>`), `Effect.runForkWith(services)` (not `Runtime.runFork`). |
| Schema type derivation | `Schema.Type<typeof S>` (not `Schema.Schema.Type`). |
| Schema decoding | `Schema.decodeUnknownEffect` / `Schema.decodeEffect` (not `decodeUnknown` / `decode`). |
| Unstable imports | HTTP, SQL, RPC, Schema utilities under `effect/unstable/*`. Never `@effect/platform` for these. |

## Pattern Matching

- `Match.type<T>()` for union discrimination. End with `Match.exhaustive`.
- `Match.when(pattern, handler)` — primary condition combinator. Supports literal patterns, predicate functions, `Match.not(predicate)`.
- `Match.tag` for `_tag`-based discriminated unions.
- `Match.value(value)` for matching against a specific concrete value.
- `Match.withReturnType<T>()` — MUST be first in pipeline. Enforces consistent return type across branches.
- `Match.option` / `Match.either` to preserve unmatched cases as `Option`/`Either`.
- Built-in predicates: `Match.number`, `Match.string`, `Match.boolean`, `Match.symbol`, `Match.undefined`, `Match.null`, `Match.instanceOf`.

## Effect.gen vs pipe

| Use pipe | Use Effect.gen |
|---|---|
| 1-3 transformations | 3+ sequential steps with dependencies |
| Simple map/filter/flatMap | Conditional logic, error handling, resource mgmt |
| Composing catchTag/timeout/retry | Imperative readability matters more |

Never mix `pipe` inside `Effect.gen`. Never nest `pipe` >3 levels. Use `Effect.gen` (not `Effect.Do`).

## Naming Table

| Element | Convention |
|---|---|
| Service interface + Tag | PascalCase noun (`UserService`) |
| Implementation | `UserServiceLive` / `UserServiceTest` |
| Layer | `UserServiceLiveLayer` |
| Error | `Schema.TaggedErrorClass` (`UserNotFoundError`) |
| Schema | `UserSchema` |
| File | kebab-case (`user-service.ts`) |

## Module Structure

```
src/user/
  user-service.ts        # Tag + interface
  user-service-live.ts   # Layer implementation
  user-service-test.ts   # Test Layer
  user-errors.ts         # TaggedError types
  user-schema.ts         # Schema definitions
```

One concern per file. Export tag + shape together. Layer files export default + named layers.

## Schema-First

```ts
import { Schema } from "effect"
export const UserSchema = Schema.Struct({ id: Schema.String, name: Schema.String })
export interface User extends Schema.Type<typeof UserSchema> {}
```

Use `Schema.TaggedErrorClass` for domain errors. Use `Schema.Data` for value equality. Use `Schema.Class` when prototype methods needed.
Compilers: `Schema.makeArbitrary(S)`. `Schema.makeJsonSchema(S)`. `Schema.makeEquivalence(S)`.
Parse errors: `ParseResult.TreeFormatter` for canonical human-readable debugging.

## Formatting

- Imports: `"effect"` first, `"@effect/*"` next, then app modules.
- Layer definitions: `Layer.effect(Tag, Effect.gen(...))` for resourceful. `Layer.succeed` for pure.
- Pipeline chains: one operation per line, indented.
- Layers are auto-memoized across `Effect.provide` calls. Opt-out: `Effect.provide(layer, { local: true })`.

## Anti-patterns (FLAG)

| Pattern | Severity |
|---|---|
| Missing `Match.exhaustive` on known union | HIGH |
| Tacit function args (`Effect.map(fn)`) | HIGH |
| Duplicate Schema + manual type | HIGH |
| `Effect.runSync` in production | HIGH |
| `@effect/platform` imports for unstable modules | HIGH |
| Nested pipe >3 levels | MEDIUM |
| Mixing `Effect.gen` + `pipe` in same expression | MEDIUM |
| Giant `Effect.gen` blocks with multiple responsibilities | MEDIUM |
| `switch` on `_tag` instead of `Match.tag` | MEDIUM |
| Data-first in multi-step chains | LOW |
| Generic file names (`types.ts`, `errors.ts`) | LOW |

## Guardrails
- Style suggestions must not alter business logic or runtime behavior.
- Verify union is closed before recommending `Match.exhaustive`. Open unions → `Match.orElse`.
- Defer to existing project conventions unless they conflict with Effect patterns.
