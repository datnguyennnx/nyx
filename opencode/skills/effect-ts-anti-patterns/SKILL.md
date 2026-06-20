---
name: effect-ts-anti-patterns
description: Detect v3 API usage, Promise-first code, hidden service dependencies, oversized Effect.gen blocks, module-level singletons, import path violations, TypeScript safety violations, incorrect service definitions. Effect-TS v4.
---

## v4 API Detection (must flag)

| v3 Pattern (FLAG) | v4 Replacement |
|---|---|
| `catchAll` | `catch` |
| `catchAllCause` | `catchCause` |
| `catchAllDefect` | `catchDefect` |
| `catchSome` | `catchFilter` |
| `catchSomeCause` | `catchCauseFilter` |
| `catchSomeDefect` | DELETED |
| `either` | `result` |
| `fork` | `forkChild` |
| `forkDaemon` | `forkDetach` |
| `forkAll` | `Effect.forEach` with `forkChild` |
| `forkWithErrorHandler` | DELETED |
| `FiberRef` | `Context.Reference` (in `References` module) |
| `Runtime<R>` / `Runtime.runFork(runtime)` | `Effect.services<R>()` / `Effect.runForkWith(services)` |
| `Effect.Do` + `Effect.bind` | `Effect.gen` |
| `Context.Tag` / `Effect.Tag` | `Context.Service` class: `class Svc extends Context.Service<Svc, Shape>()("Svc") {}` |
| `Schema.Schema.Type<typeof S>` | `Schema.Type<typeof S>` |
| `Schema.decodeUnknown` / `Schema.decode` | `Schema.decodeUnknownEffect` / `Schema.decodeEffect` |
| `new Schema.ArbitraryCompiler()` | `Schema.makeArbitrary(S)` |
| `Schema.Codec.ToAsserts` | `Schema.asserts(schema, input)` |
| `@effect/platform` for HTTP/SQL/RPC/Schema | `effect/unstable/*` |

## Structural Detection

| Anti-pattern | Detect | Impact | Severity |
|---|---|---|---|
| Promise-first code | `await` / `.then()` / `new Promise` inside `Effect.gen` without Effect interop | Uncontrolled computation — bypasses concurrency, error tracking, interruption | HIGH |
| Hidden service deps | Concrete types (drivers, clients, config objects) in `Requirements` instead of Context tags | Brittle coupling — untestable, unswappable | HIGH |
| Oversized Effect.gen | Single block mixing validation + fetch + transform + persist + log | Untestable phases, impossible error-path reasoning | MEDIUM |
| Module-level singleton | `const client = new Pool()` at module scope, not inside `Layer` | No release path, no test substitution, invisible lifetime | HIGH |
| Misaligned imports | Non-canonical, internal, or platform-specific subpaths | Unstable API surface — can break on minor version | HIGH |
| TypeScript safety violations | `any`, `as` casts erasing Effect's `A`/`E`/`R` channels | Disables all 3 compiler verifications simultaneously | HIGH |
| Bad service definition | Tag without shape interface, or tag+impl same class | Consumers can't see operations; can't substitute implementations | MEDIUM |
| `Effect.Do` usage | v3-only pattern deleted in v4 | Won't compile | HIGH |
| Tacit function refs | `Effect.map(fn)` instead of `Effect.map((x) => fn(x))` | Erases generics, breaks inference, unclear stack traces | MEDIUM |
| Wall-clock time | `Date.now()` / `new Date()` instead of `Clock` | Breaks referential transparency, testability, determinism | HIGH |

## DO NOT detect here — delegate

| Concern | Delegate to |
|---|---|
| Concurrency (forkChild, Semaphore, Queue) | `effect-ts-concurrency` |
| Typed errors, catch, retry, recovery | `effect-ts-error-handling` |
| Resource lifecycle, `Scope`, `acquireRelease` | `effect-ts-resource-layer` |
| Mental model violations (mid-flight execution, per-request provisioning) | `effect-ts-principle-thinking` |

## Severity

| Level | Criteria |
|---|---|
| HIGH | Direct type unsafety, runtime resource leaks, prevents testable substitution, v3 API that won't compile |
| MEDIUM | Structural degradation — hurts clarity, testability, maintainability |
| LOW | Non-idiomatic but functionally correct |

## Output per finding
- File:line location
- Anti-pattern name (from table above)
- Delegation target skill for fix
- Risk level (HIGH/MEDIUM/LOW)

## Guardrails
- Detect structural patterns only. Never diagnose runtime behavior.
- Never suggest implementation changes — flag and delegate to the fix skill.
- Per finding, specify which skill handles the fix.
- Focus on timeless structural principles, not version-specific APIs except v3→v4 migration.
- v4 beta APIs shift between releases — verify existence in `packages/effect/src/*.ts` before including in findings.
