---
name: effect-ts-code-conventions
description: Idiomatic Effect-TS v4 coding style — pattern matching, Effect.gen, naming, module structure, Schema-first design, formatting.
---

## v4 Renames — Flag v3 APIs

| v3 (WRONG) | v4 (CORRECT) |
|---|---|
| `Context.Tag` / `Effect.Tag` / `Effect.Service` class | `Context.Service` class syntax: `class Svc extends Context.Service<Svc, Shape>()("Svc") {}` |
| `catchAll` | `catch` |
| `catchSome` | `catchFilter` |
| `catchAllCause` | `catchCause` |
| `catchAllDefect` | `catchDefect` |
| `catchSomeDefect` | DELETED |
| `either` | `result` |
| `fork` | `forkChild` |
| `forkDaemon` | `forkDetach` |
| `forkAll` / `forkWithErrorHandler` | DELETED |
| `FiberRef` | `Context.Reference` in `References` module |
| `Runtime<R>` / `Runtime.runFork` | `Effect.services<R>()` / `Effect.runForkWith(services)` |
| `Effect.Do` | DELETED → use `Effect.gen` |
| `Schema.Schema.Type<typeof S>` | `Schema.Type<typeof S>` |
| `Schema.decodeUnknown` | `Schema.decodeUnknownEffect` |
| `Schema.decode` | `Schema.decodeEffect` |

## Style Rules

| Rule | Enforce |
|---|---|
| Pattern matching | `Match.type` / `Match.tag` over `if/else` / `switch`. Always `Match.exhaustive` on known unions. |
| Effect.gen | For 3+ sequential effectful steps. One `yield*` per line. Keep blocks single-screen. |
| pipe | For 1-3 transformations. Never nest >3 levels. |
| No tacit | Always `Effect.map((x) => fn(x))`, never `Effect.map(fn)`. Preserves generics and stack traces. |
| Schema-first | Define `Schema.Struct` once. Derive type: `Schema.Type<typeof S>`. Never duplicate. |
| Naming | Service = PascalCase noun. Layer = `ServiceNameLayer`. Error = `Schema.TaggedErrorClass`. File = kebab-case of primary export. |
| Branding | `Brand.nominal` for type distinction. `Brand.refined` for runtime validation. Not a general validation framework. |
| No mid-flight execution | Never `Effect.runSync`/`runPromise` in services/layers. Tests only. |
| Entry points | `NodeRuntime.runMain` from `@effect/platform-node`. Handles graceful SIGINT teardown. |

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

Never mix `pipe` inside `Effect.gen`. Never nest `pipe` >3 levels.
`Effect.Do` is DELETED in v4 — migrate to `Effect.gen`.

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
export interface User extends Schema.Type<typeof UserSchema> {} // v4: Schema.Type, not Schema.Schema.Type
```

Use `Schema.TaggedErrorClass` for domain errors. Use `Schema.Data` for value equality. Use `Schema.Class` when prototype methods needed.
Compilers: `Schema.makeArbitrary(S)` not `new Schema.ArbitraryCompiler()`. `Schema.makeJsonSchema(S)`. `Schema.makeEquivalence(S)`.
Parse errors: `ParseResult.TreeFormatter` for canonical human-readable debugging.

## Formatting

- Imports: `"effect"` first, `"@effect/*"` next, then app modules.
- Layer definitions: `Layer.effect(Tag, Effect.gen(...))` for resourceful. `Layer.succeed` for pure.
- Pipeline chains: one operation per line, indented.
- Layers are auto-memoized across `Effect.provide` calls (v4). Opt-out: `Effect.provide(layer, { local: true })`.

## Anti-patterns (FLAG)

| Pattern | Severity |
|---|---|
| Missing `Match.exhaustive` on known union | HIGH |
| Tacit function args (`Effect.map(fn)`) | HIGH |
| Duplicate Schema + manual type | HIGH |
| `Effect.runSync` in production | HIGH |
| v3 API usage (`catchAll`, `fork`, `either`, `Effect.Do`, `Context.Tag`, `FiberRef`) | HIGH |
| Nested pipe >3 levels | MEDIUM |
| Mixing `Effect.gen` + `pipe` in same expression | MEDIUM |
| Giant `Effect.gen` blocks with multiple responsibilities | MEDIUM |
| `switch` on `_tag` instead of `Match.tag` | MEDIUM |
| Data-first in multi-step chains | LOW |
| Generic file names (`types.ts`, `errors.ts`) | LOW |
| `@effect/platform` imports for unstable modules | HIGH |

## Guardrails
- Style suggestions must not alter business logic or runtime behavior.
- Verify union is closed before recommending `Match.exhaustive`. Open unions → `Match.orElse`.
- Defer to existing project conventions unless they conflict with Effect v4 patterns.
