---
name: effect-ts-anti-patterns
description: Detect Promise-first code, hidden service dependencies, and oversized Effect.gen blocks in Effect-TS code.
---

# Companion Skill
Load `effect-ts` alongside this skill for research strategy, installation guidelines, and access to detailed reference guides (`../effect-ts/references/guide-effect.md`, `../effect-ts/references/guide-error-handling.md`, `../effect-ts/references/guide-layers.md`, `../effect-ts/references/guide-schema.md`, `../effect-ts/references/guide-testing.md`). The main `effect-ts` skill provides the canonical research methodology: local guides first → codebase patterns → Effect source code.

# Purpose
This skill identifies syntax-level and code-smell anti-patterns in Effect-TS code. It does NOT cover concurrency, error handling, resource lifecycle, or mental model violations — those are delegated to their dedicated skills. This skill is a pure detection lens: it flags patterns, never prescribes fixes beyond suggesting delegation to the appropriate skill.

# Use when
Reviewing Effect-TS source files to detect:
- Raw Promise usage outside `Effect.tryPromise`/`Effect.async`
- Service interfaces leaking implementation dependencies in their requirements
- Overly complex `Effect.gen` blocks mixing multiple concerns
- Module-level singleton resource construction
- Deleted `Effect.Do` notation (must use `Effect.gen`)
- Wrong `@effect/platform` import paths for HTTP/SQL/RPC/Schema utilities (use `effect/unstable/*`)
- Deprecated API usage: `Context.Tag`/`Effect.Tag`/`Effect.Service`/`ServiceMap.Service`, `FiberRef`, `catchAll`/`catchSome`/`Effect.either`, `fork`/`forkDaemon`/`forkAll`, `Effect.runtime`, `Schema.decodeUnknown`/`Schema.decode`/`Schema.Codec.ToAsserts`

DO NOT use for:
- Concurrency correctness (fork, Semaphore, Queue) — delegate to `effect-ts-concurrency`
- Typed error handling or error recovery — delegate to `effect-ts-error-handling`
- Resource lifecycle or Layer construction — delegate to `effect-ts-resource-layer`
- Mental model violations (mid-flight execution, per-request provisioning) — delegate to `effect-ts-principle-thinking`

# Inputs
- Effect-TS source files (.ts, .tsx)
- Service interface definitions
- Effect.gen usage patterns
- Effect.Do usage (deleted)
- Import paths (@effect/platform vs effect/unstable/*)
- Promise interop code (async/await inside generators)
- Deprecated API usage: Context.Tag, FiberRef, catchAll, fork, Effect.either, Effect.runtime, Schema.decodeUnknown

# Core principles
- Prefer Effect-native constructors over raw Promise interop
- Keep service interface requirements free of implementation details
- Keep `Effect.gen` blocks focused on a single responsibility
- This skill detects syntax-level patterns only — deeper analysis is always delegated

# Preferred patterns
- Use `Effect.tryPromise` or `Effect.async` for wrapping Promise-based APIs
- Define services with `Context.Service` class syntax: `class Svc extends Context.Service<Svc, Shape>()("Svc") {}`
- Use `Context.Reference` (from `References`) for fiber-local state
- Keep `Effect.gen` blocks to 1-3 focused responsibilities
- Use `Effect.catch`, `Effect.catchCause`, `Effect.catchDefect`, `Effect.catchFilter`, `Effect.catchCauseFilter` for error recovery
- Use `Effect.forkChild` / `Effect.forkDetach` for forking; `Effect.forEach` with `forkChild` for bulk
- Use `Effect.result` for absorbing errors
- Use `Effect.services<R>()` / `Effect.runForkWith` for runtime services
- Use `Schema.decodeUnknownEffect`/`Schema.decodeEffect`/`Schema.asserts` for Schema codec operations
- Import from `effect/unstable/*` for HTTP, SQL, RPC, Schema utilities
- Use `Layer` (via `effect-ts-resource-layer`) for dependency wiring, not module-scope singletons

# Anti-patterns
- **Promise-first code:** `await fetch()` inside `Effect.gen` without proper lifting through `Effect.tryPromise`
- **Hidden dependencies:** service interfaces requiring concrete implementation types in their `Requirements` type
- **Oversized generators:** `Effect.gen` blocks mixing data fetching, transformation, and persistence logic
- **Module-level singletons:** constructing resources (clients, pools) at module scope instead of inside `Layer`
- **Deleted Effect.Do:** `Effect.Do` blocks — must migrate to `Effect.gen`
- **Wrong unstable imports:** importing from `@effect/platform` for HTTP/SQL/RPC/Schema — use `effect/unstable/*` instead
- **Deprecated Context.Tag/Effect.Tag:** service definition using `Context.Tag`/`Effect.Tag`/`Effect.Service`/`ServiceMap.Service` — use `Context.Service` class syntax
- **Deprecated FiberRef:** fiber-local state with `FiberRef` — use `Context.Reference` exported from `References`
- **Deprecated error handling:** `catchAll`/`catchAllCause`/`catchAllDefect`/`catchSome`/`catchSomeCause`/`catchSomeDefect` — use `catch`/`catchCause`/`catchDefect`/`catchFilter`/`catchCauseFilter`; `catchSomeDefect` is deleted
- **Deprecated forking:** `fork`/`forkDaemon`/`forkAll`/`forkWithErrorHandler` — use `forkChild`/`forkDetach`; `forkAll` and `forkWithErrorHandler` are deleted
- **Deprecated result handling:** `Effect.either` — use `Effect.result`
- **Deprecated runtime:** `Effect.runtime<R>()` — use `Effect.services<R>()`; `Runtime.runFork` → `Effect.runForkWith`
- **Deprecated Schema APIs:** `decodeUnknown` → `decodeUnknownEffect`, `decode` → `decodeEffect`, `Schema.Codec.ToAsserts` → `Schema.asserts(schema, input)`

# Workflow
1. Scan for raw `await` calls inside `Effect.gen` and flag for `Effect.tryPromise` wrapping
2. Check service interfaces for implementation-specific types leaking into their `Requirements`
3. Review `Effect.gen` blocks for >3 distinct responsibilities and suggest splitting
4. Detect module-level `const db = new Pool()` or similar singleton patterns outside `Layer`
5. Scan for deleted `Effect.Do` notation and flag migration to `Effect.gen`
6. Check import paths for `@effect/platform` modules that moved to `effect/unstable/*`
7. Detect deprecated APIs: `Context.Tag`, `Effect.Tag`, `Effect.Service`, `FiberRef`, `catchAll`/`catchSome`, `Effect.either`, `fork`/`forkDaemon`, `Effect.runtime`, `Schema.decodeUnknown`/`Schema.decode`/`Schema.Codec.ToAsserts`
8. For each finding: flag and delegate to the appropriate skill for fix guidance
9. Document each finding with location, pattern name, and delegation target

# Output contract
Return findings with:
- File location and line numbers
- Specific anti-pattern detected (from list above)
- Explanation of why it is a syntax/code-smell issue
- Delegation target skill for the fix
- Risk level (low/medium/high — syntax-severity only)

# Severity Criteria
When assigning risk levels, use these definitions:
- **HIGH**: Pattern causes direct type unsafety, runtime failure, or severe maintainability degradation
- **MEDIUM**: Pattern violation that degrades clarity or testability but does not cause immediate failures
- **LOW**: Non-idiomatic pattern — functionally correct but not following best practices

# Acceptable Patterns (do NOT flag)
These patterns are correct usage — do not flag them as anti-patterns:
- `Effect.tryPromise` or `Effect.async` wrapping Promise code — this IS proper Promise interop
- `Effect.gen` blocks with 1-3 focused responsibilities — this IS acceptable complexity
- `Layer.succeed` for simple config values or pure dependencies — this IS correct
- Service interfaces requiring only service tags in their Context — this IS clean boundary
- `Effect.catchTag` / `Effect.catchTags` for specific typed error handling — delegated to `effect-ts-error-handling`
- `Effect.catch` / `Effect.catchCause` / `Effect.catchFilter` for error handling — delegated to `effect-ts-error-handling`
- `Effect.forkChild` / `Effect.forkDetach` for forking — this IS correct fiber usage
- `Effect.result` for absorbing errors — this IS correct error absorption
- `Context.Service` class syntax for service definition — this IS the standard
- `Context.Reference` for fiber-local state — this IS correct fiber-local state management
- `effect/unstable/*` imports for HTTP/SQL/RPC/Schema — this IS the correct import path
- `Effect.services<R>()` / `Effect.runForkWith` — this IS correct runtime services usage
- `Schema.decodeUnknownEffect` / `Schema.decodeEffect` / `Schema.asserts` — this IS correct Schema codec usage
- `Effect.gen` blocks with 1-3 focused responsibilities — this IS acceptable complexity
- `Scope` for localized resource lifetime — delegated to `effect-ts-resource-layer`

# Related Guides (from effect-ts skill references/)
- `../effect-ts/references/guide-effect.md` — Core `Effect` usage, constructors, composition, provisioning
- `../effect-ts/references/guide-error-handling.md` — Defining errors, schema-based errors, failure handling
- `../effect-ts/references/guide-layers.md` — Services, layer construction, composition, provisioning
- `../effect-ts/references/guide-testing.md` — Vitest integration, layered test setup

# Delegation
This skill is a syntax-level and structural lens ONLY. For deeper analysis, delegate to:
- **effect-ts** for research strategy, installation guidelines, and in-depth guidance
- **effect-ts-principle-thinking** for mental model violations (mid-flight execution, per-request provisioning, closure state leaks, DI violations)
- **effect-ts-error-handling** for anything involving typed errors, catch blocks, retry, or error recovery
- **effect-ts-resource-layer** for anything involving `Scope`, `Layer`, `acquireRelease`, or resource lifecycle
- **effect-ts-concurrency** for anything involving `fork`, `Semaphore`, `Queue`, parallel collections, or fiber management

# Guardrails
- Only detect syntax-level and structural code-smell patterns
- NEVER diagnose concurrency correctness — delegate to `effect-ts-concurrency`
- NEVER diagnose error handling or typed errors — delegate to `effect-ts-error-handling`
- NEVER diagnose resource lifecycle or Layer patterns — delegate to `effect-ts-resource-layer`
- NEVER diagnose mental model violations — delegate to `effect-ts-principle-thinking`
- For every finding, specify which skill should handle the fix guidance
- If a finding spans multiple domains, flag each domain separately and delegate to each skill
- Do not suggest implementation changes — flag and delegate
