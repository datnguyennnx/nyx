---
name: effect-ts-anti-patterns
description: Detect Promise-first code, hidden service dependencies, and oversized Effect.gen blocks in Effect-TS code.
---

# Companion Skill
Load `effect-ts` alongside this skill for research strategy, installation guidelines, and access to detailed reference guides (`../effect-ts/references/guide-effect.md`, `../effect-ts/references/guide-error-handling.md`, `../effect-ts/references/guide-layers.md`, `../effect-ts/references/guide-schema.md`, `../effect-ts/references/guide-testing.md`). The main `effect-ts` skill provides the canonical research methodology: local guides first → codebase patterns → Effect source code.

# Purpose
This skill identifies structural and code-smell anti-patterns in Effect-TS code. It does NOT cover concurrency, error handling, resource lifecycle, or mental model violations — those are delegated to their dedicated skills. This skill is a pure detection lens: it flags patterns, never prescribes fixes beyond suggesting delegation to the appropriate skill.

# Use when
Reviewing Effect-TS source files to detect:
- Raw Promise usage inside `Effect.gen` blocks without proper lifting through Effect's Promise interop constructors
- Service interfaces leaking concrete implementation types into their `Requirements` parameter
- Overly complex `Effect.gen` blocks mixing data fetching, transformation, persistence, and logging
- Module-level singleton resource construction (clients, pools, connections) outside `Layer` with proper lifecycle semantics
- Import paths that bypass the canonical module boundary (internal or unstable paths used in production code)
- TypeScript safety violations: `any`, unchecked type assertions, casts that erase Effect's type-level guarantees
- Incorrect service definition patterns — tags declared without shape interfaces, conflating tags with implementations

DO NOT use for:
- Concurrency correctness (fork, Semaphore, Queue) — delegate to `effect-ts-concurrency`
- Typed error handling or error recovery — delegate to `effect-ts-error-handling`
- Resource lifecycle or Layer construction — delegate to `effect-ts-resource-layer`
- Mental model violations (mid-flight execution, per-request provisioning) — delegate to `effect-ts-principle-thinking`

# Inputs
- Effect-TS source files (.ts, .tsx)
- Service interface definitions and their `Requirements` type parameters
- `Effect.gen` usage patterns and block boundaries
- Import path resolution for Effect and platform modules
- Promise interop code (`async`/`await` inside generators, raw `.then()` calls)
- TypeScript type safety violations (`any`, `as` casts, unsafe assertions)
- Resource construction at module scope vs. inside `Layer`

# Core principles
- Prefer Effect-native constructors for lifting side effects over raw Promise interop — every raw Promise is an unmanaged escape hatch
- Keep service interface requirements free of implementation details — the `Requirements` type parameter should contain only Context tags, not concrete types
- Keep `Effect.gen` blocks focused on a single responsibility — a generator that does everything is a generator that is impossible to test
- Resource acquisition and release must be explicit through `Layer` lifecycle, not implicit at module scope
- Import paths should resolve to the canonical public API surface of each package — internal paths are not contracts
- Type safety is the primary value Effect provides — bypassing it with `any` or `as` negates the library's purpose
- This skill detects structural patterns only — deeper analysis is always delegated

# Preferred patterns
- Lift Promise-based APIs (fetch, file I/O, timers, callbacks) into Effect using the appropriate interop constructors
- Define services using Context tags with explicit shape interfaces: the tag type parameter declares the service's contract, the shape interface lists its operations
- Keep `Effect.gen` blocks focused on a single phase of a pipeline (orchestration, not implementation)
- Construct resources (database clients, HTTP pools, message queues) inside `Layer` with explicit acquisition and release semantics
- Import from the canonical module path for each Effect package — this is the contract the package maintains across versions
- Use Effect's error channel for typed, recoverable failures — maintain the distinction between expected errors (typed in `E`) and unexpected defects
- Use Effect's fiber management operators for structured concurrency — fibers are children of their parent scope and are cleaned up automatically

# Anti-patterns

- **Promise-first code:** Using raw `await` with `fetch`, `axios`, `Promise`, or any Promise-based API inside `Effect.gen` without lifting through Effect's Promise interop constructors. Why this is dangerous: a Promise is an uncontrolled computation that bypasses Effect's structured concurrency, error tracking, and interruption model. A rejected Promise becomes an unmanaged defect rather than a typed error in the `E` channel. The caller loses fiber execution visibility, and interruption signals are silently swallowed. The Promise executes in a different scope than the Effect — it cannot be managed, supervised, or scoped.

- **Hidden service dependencies:** Concrete implementation types (database drivers, HTTP clients, configuration objects) leaking into a service's `Requirements` type parameter instead of abstract Context tags. Why this is dangerous: it couples every consumer to a specific implementation, makes it impossible to substitute layers for testing, and creates brittle dependency graphs where changing one implementation cascades through every file that imports the type. A service interface should declare its needs as Context tags — abstract contracts that can be satisfied by any implementation.

- **Oversized Effect.gen blocks:** A single generator block mixing data validation, fetching, transformation, persistence, logging, and error recovery. Why this is dangerous: it violates separation of concerns, makes reasoning about error paths impossible (which line can fail? what happens on each failure?), destroys the ability to test individual phases in isolation, and creates massive functions that resist refactoring. A generator block that is longer than a handful of lines and touches multiple domains should be decomposed.

- **Module-level singleton resource construction:** Allocating database clients, HTTP connection pools, message queue producers, or file handles at module scope as eagerly evaluated constants rather than inside a `Layer`. Why this is dangerous: resources are initialized at import time (not when the program requires them), there is no release path (connections leak on program exit), substitution for testing is impossible because the singleton is captured in the module's closure, and lifetime management is entirely invisible to the Effect runtime. Any resource that requires setup and teardown belongs inside `Layer` with explicit acquisition and release.

- **Misaligned import paths:** Importing from internal, unstable, or platform-specific subpaths that are not the canonical public module boundary. Why this is dangerous: these paths are not part of the library's public API contract — they can change or be removed between minor versions without notice. Different build tools may resolve them inconsistently, and tree-shaking and bundling optimizations may not apply. Every module should be imported from its canonical path as documented by the package's public API surface.

- **TypeScript safety violations:** Using `any`, unchecked type assertions (`as`), or casts that erase Effect's type-level guarantees on the success channel (`A`), error channel (`E`), or requirements channel (`R`). Why this is dangerous: Effect's type parameters are not decorative — they are the mechanism by which the compiler verifies that error recovery is exhaustive, all required services are provided, and the success value is correctly transformed. An `as Effect<any, any, any>` cast disables all three channels simultaneously, making every subsequent operation unchecked. `any` on the error channel means the compiler cannot verify that error handlers cover all possible failures.

- **Incorrect service definition patterns:** Declaring service tags without proper shape interfaces, reusing tags across unrelated service boundaries, or defining service implementations as classes that conflate the tag identity with the business logic. Why this is dangerous: the tag is the service's identity in the Context system — without a shape interface, consumers cannot see what operations a service provides, and the compiler cannot verify that an implementation satisfies the contract. When a tag and its implementation are the same class, you cannot substitute implementations without also changing the tag. The service tag and the service implementation must be separate concerns.

# Workflow
1. Scan for raw `await` calls, `.then()` chains, or `new Promise(...)` inside `Effect.gen` blocks — flag for lifting into Effect's Promise interop constructors
2. Inspect service interface definitions and their `Requirements` type parameter — flag concrete implementation types that should be abstract Context tags
3. Review `Effect.gen` blocks for breadth of responsibility — flag blocks that mix more than one data domain (e.g., fetching + transforming + persisting + logging)
4. Detect module-level `const` declarations that construct resources (clients, pools, drivers, connections) — flag for migration into `Layer`
5. Check import paths against the canonical public API surface of each package — flag non-canonical paths
6. Scan for `any` type annotations, `as` type assertions, or unsafe casts on `Effect`, `Layer`, or `Context` values — flag each with the channel(s) it erases
7. Inspect service tag declarations for missing shape interfaces or tag-implementation conflation — flag each violation with the correct pattern
8. For each finding: flag and delegate to the appropriate skill for fix guidance
9. Document each finding with location, pattern name, and delegation target

# Output contract
Return findings with:
- File location and line numbers
- Specific anti-pattern detected (from list above)
- Narrative explanation of why it is a structural risk
- Delegation target skill for the fix
- Risk level (low/medium/high — structural-severity only)

# Severity Criteria
When assigning risk levels, use these definitions:
- **HIGH**: Pattern causes direct type unsafety, runtime resource leaks, or prevents testable service substitution
- **MEDIUM**: Pattern violates structural best practices — degrades clarity, testability, or maintainability but does not cause immediate failures
- **LOW**: Non-idiomatic pattern — functionally correct but does not follow established Effect conventions

# Acceptable Patterns (do NOT flag)
These patterns are correct usage — do not flag them as anti-patterns:
- Lifting Promise-based APIs using Effect's standard Promise interop constructors — this IS proper Promise integration
- Service interfaces requiring only Context tags in their `Requirements` — this IS clean service boundary
- `Effect.gen` blocks focused on a single domain concern — this IS acceptable complexity
- `Layer`-based resource construction with explicit acquisition and release — this IS correct lifecycle management
- Importing from canonical public module paths — this IS correct module resolution
- Properly typed Effect values with explicit `A`, `E`, and `R` type parameters — this IS correct type discipline
- Context tags declared with explicit shape interfaces and separate implementation classes — this IS correct service separation
- Error handling via the typed error channel — delegated to `effect-ts-error-handling`
- Fiber management via Effect's structured concurrency operators — delegated to `effect-ts-concurrency`
- Resource scope management via `Scope` and `Layer` — delegated to `effect-ts-resource-layer`

# Related Guides (from effect-ts skill references/)
- `../effect-ts/references/guide-effect.md` — Core `Effect` usage, constructors, composition, provisioning
- `../effect-ts/references/guide-error-handling.md` — Defining errors, schema-based errors, failure handling
- `../effect-ts/references/guide-layers.md` — Services, layer construction, composition, provisioning
- `../effect-ts/references/guide-testing.md` — Vitest integration, layered test setup

# Delegation
This skill is a structural lens ONLY. For deeper analysis, delegate to:
- **effect-ts** for research strategy, installation guidelines, and in-depth guidance
- **effect-ts-principle-thinking** for mental model violations (mid-flight execution, per-request provisioning, closure state leaks, DI violations)
- **effect-ts-error-handling** for anything involving typed errors, catch blocks, retry, or error recovery
- **effect-ts-resource-layer** for anything involving `Scope`, `Layer`, `acquireRelease`, or resource lifecycle
- **effect-ts-concurrency** for anything involving fork, Semaphore, Queue, parallel collections, or fiber management

# Guardrails
- Only detect structural and code-smell patterns — never diagnose runtime behavior
- NEVER diagnose concurrency correctness — delegate to `effect-ts-concurrency`
- NEVER diagnose error handling or typed errors — delegate to `effect-ts-error-handling`
- NEVER diagnose resource lifecycle or Layer patterns — delegate to `effect-ts-resource-layer`
- NEVER diagnose mental model violations — delegate to `effect-ts-principle-thinking`
- For every finding, specify which skill should handle the fix guidance
- If a finding spans multiple domains, flag each domain separately and delegate to each skill
- Do not suggest implementation changes — flag and delegate
- Do not reference specific version numbers, migration guides, or deprecated API lists — focus on timeless structural principles
- When describing correct patterns, describe the structural property (e.g., "separate tag identity from implementation") rather than a specific API incantation
