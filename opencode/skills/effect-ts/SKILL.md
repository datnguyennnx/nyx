---
name: effect-ts
description: Effect-TS v4 expert guidance — patterns, services, layers, schemas, streams, runtimes, typed error handling. Load as base skill in all Effect-TS work.
---

## Research Strategy

1. **Local guides first** (`./references/`) — preferred source for best practices
2. **Codebase patterns second** — follow existing project conventions
3. **Effect source last** (`./.repos/effect/`) — only for gaps, exact API details, or behavior verification

## Prerequisite

Check `./.repos/effect` exists. If not → prompt user with `./references/setup.md`.

## Guide Discovery

| Area | Guide |
|---|---|
| Core Effect | `./references/guide-effect.md` |
| Error handling | `./references/guide-error-handling.md` |
| Layers / DI | `./references/guide-layers.md` |
| Observability | `./references/guide-observability.md` |
| Retries | `./references/guide-retries.md` |
| Scheduling | `./references/guide-schedule.md` |
| Schema | `./references/guide-schema.md` |
| SQL | `./references/guide-sql.md` |
| Testing | `./references/guide-testing.md` |
| Features index | `./references/features.md` |

## Installation

- `effect@latest` + aligned `@effect/*` versions (same version number)
- All packages unified: `@effect/platform`, `@effect/rpc`, `@effect/cli`, `@effect/experimental`, `@effect/typeclass` → merged into `effect` under `effect/unstable/*`
- Add runtime packages as needed: `@effect/platform-node`, `@effect/platform-browser`, `@effect/platform-bun`, `@effect/vitest`, `@effect/sql-*`, `@effect/ai-*`

## v4 Core Rules

### Service Definition
Use `Context.Service` class syntax (v4):
```ts
class Svc extends Context.Service<Svc, Shape>()("Svc") {}
// Access via .use() accessor, not static proxy
```

### Error Handling (v4 renames)
| v3 | v4 |
|---|---|
| `catchAll` | `catch` |
| `catchAllCause` | `catchCause` |
| `catchAllDefect` | `catchDefect` |
| `catchSome` | `catchFilter` |
| `catchSomeCause` | `catchCauseFilter` |
| `catchSomeDefect` | DELETED |
| `either` | `result` |

### Forking (v4 renames)
| v3 | v4 |
|---|---|
| `fork` | `forkChild` |
| `forkDaemon` | `forkDetach` |
| `forkAll` | DELETED → use `Effect.forEach` with `forkChild` |
| `forkWithErrorHandler` | DELETED |

### Fiber State
`FiberRef` removed → use `Context.Reference`. Built-in refs in `References` module (e.g. `References.CurrentLogLevel`).

### Runtime
`Runtime<R>` removed → use `Effect.services<R>()`. `Runtime.runFork(runtime)(program)` → `Effect.runForkWith(services)(program)`. `ManagedRuntime.make(AppLayer)` still valid for framework bridging.

### Cause
Cause no longer recursive tree. Iterate via `for (const reason of cause.reasons)` with `reason._tag "Fail" | "Die" | "Interrupt"`.

### Do Notation
`Effect.Do` deleted → must use `Effect.gen`.

### Unstable Imports
HTTP, SQL, RPC, Schema utilities under `effect/unstable/*`. Never use `@effect/platform` for these.

### Schema
`Schema.decodeUnknown` → `Schema.decodeUnknownEffect`. `Schema.decode` → `Schema.decodeEffect`. `Schema.Codec.ToAsserts` removed → use `Schema.asserts(schema, input)`.

## Core Rules

| Rule | Enforce |
|---|---|
| Typed errors | `Schema.TaggedErrorClass` / `Data.TaggedError`. Never throw. Use `catch` (v4) not `catchAll` (v3). |
| DI via Layers | `Context.Service` class syntax. Compose with `Layer.mergeAll` / `Layer.provide`. |
| No `any` / `as` casts | Validate/decode at boundaries instead of asserting types. |
| Time via `Clock` | Never `Date.now()` / `new Date()`. Use `Effect.sleep` over `setTimeout`. |
| `Effect.fn` for business logic | Prefer over raw `Effect.gen`. `Effect.fnUntraced` only for measured hot-path. |
| Schema-first | Define `Schema.Struct` once. Derive type via `Schema.Type<typeof S>`. Never duplicate. |
| No mid-flight execution | `Effect.runPromise`/`runSync` only at program entry points (tests, main). |
| Ref/Deferred/Fiber explicit | Not Effect subtypes — use `Ref.get`, `Deferred.await`, `Fiber.join`. |
| Avoid tacit style | `Effect.map((x) => fn(x))` never `Effect.map(fn)` — preserves generics and stack traces. |
| Run via `runMain` | `NodeRuntime.runMain` from `@effect/platform-node`. Handles graceful SIGINT teardown. |

## References

- `./references/features.md`
- `./references/guide-effect.md`
- `./references/guide-error-handling.md`
- `./references/guide-layers.md`
- `./references/guide-observability.md`
- `./references/guide-retries.md`
- `./references/guide-schedule.md`
- `./references/guide-schema.md`
- `./references/guide-sql.md`
- `./references/guide-testing.md`
- `./references/setup.md`
