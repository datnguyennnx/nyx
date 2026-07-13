---
name: effect-ts-anti-patterns
description: Detect Promise-first code, hidden service dependencies, oversized Effect.gen blocks, module-level singletons, import path violations, TypeScript safety violations, incorrect service definitions.
---

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
| Tacit function refs | `Effect.map(fn)` instead of `Effect.map((x) => fn(x))` | Erases generics, breaks inference, unclear stack traces | MEDIUM |
| Wall-clock time | `Date.now()` / `new Date()` instead of `Clock` | Breaks referential transparency, testability, determinism | HIGH |

## Severity

| Level | Criteria |
|---|---|
| HIGH | Direct type unsafety, runtime resource leaks, prevents testable substitution, API that won't compile |
| MEDIUM | Structural degradation — hurts clarity, testability, maintainability |
| LOW | Non-idiomatic but functionally correct |

## Output per finding
- File:line location
- Anti-pattern name (from table above)
- Risk level (HIGH/MEDIUM/LOW)

## Guardrails
- Detect structural patterns only. Never diagnose runtime behavior.
- Never suggest implementation changes — flag the issue only.
- Focus on timeless structural principles.
- Beta APIs shift between releases — verify existence in `packages/effect/src/*.ts` before including in findings.
