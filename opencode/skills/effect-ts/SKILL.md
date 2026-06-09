---
name: effect-ts
description: Use this skill whenever working in a repository that uses Effect, even if the current task is in a new file or the user does not explicitly ask for Effect help. Apply it to any work that should follow the repository's Effect patterns, conventions, architecture, or supporting tooling. Also use it for questions about Effect patterns, services, layers, schemas, streams, runtimes, or typed error handling.
---

# Effect Expert

Expert guidance for programming with the Effect library, covering error handling, dependency injection, composability, and testing patterns.

## Prerequisite

Before doing any other Effect-related work, check that `./.repos/effect` exists at the root of the repository where the skill is being used.

If it does not exist, stop and prompt the user with the setup task documented in `./references/setup.md`.

## Research Strategy

Effect has many ways to accomplish the same task. Proactively research best practices when working with Effect patterns, especially for moderate to high complexity tasks.

Use the local guides in `./references/` first. They are the preferred source for best practices, conventions, and common implementation patterns.

Only go directly to the vendored Effect repo when:

- the guides do not cover the question
- you need exact API details or signatures
- you need deeper implementation details
- you need to verify a behavior against the source

### Research Sources

1. Local skill guides first. Start with the relevant files in `./references/` before doing deeper research.
2. Codebase patterns second. Examine similar patterns in the current project before implementing. If Effect patterns already exist, follow them for consistency. If no patterns exist, skip this step.
3. Effect source code last. For gaps in the guides, complex type errors, unclear behavior, or implementation details, examine the vendored Effect source at `./.repos/effect/packages/effect/src/`.

### When To Research

- Always research for services, layers, or complex dependency injection.
- Always research for error handling with multiple error types or complex error hierarchies.
- Always research for stream-based operations and reactive patterns.
- Always research for resource management with scoped effects and cleanup.
- Always research for concurrent or performance-critical code.
- Always research for unfamiliar testing patterns.
- Research when needed for complex refactors from promises or try/catch into Effect.
- Research when needed for new service dependencies or layer restructuring.
- Research when needed for custom error types or extensions of existing error hierarchies.
- Research when needed for integrations with external systems such as databases, APIs, or third-party services.

### Research Approach

- Focus on canonical, readable, and maintainable solutions rather than clever optimizations.
- Verify suggested approaches against existing codebase patterns when those patterns exist.
- When multiple approaches are possible, prefer the most idiomatic Effect solution supported by the codebase and the vendored source.

### Codebase Pattern Discovery

When working in a project that uses Effect, check for existing patterns before implementing new code:

1. Search for Effect imports and existing module usage to understand current conventions.
2. Identify how services and layers are structured in the project.
3. Note how errors are defined and propagated.
4. Examine how Effect code is tested in the project.

If no Effect patterns exist in the codebase, proceed using canonical patterns from the vendored Effect source and examples. Do not block on missing codebase patterns.

### Feature Discovery

When you need to discover available Effect modules, packages, or capabilities, search `./references/features.md` first.

- Use it to identify the right package or module for a task.
- Use the listed repo paths to jump directly into the vendored source under `./.repos/effect`.
- Use it before inventing custom abstractions when Effect may already provide the functionality.

### Guide Discovery

When the task touches one of these areas, consult the matching guide before implementing:

- `./references/guide-effect.md` for core `Effect` usage patterns, common constructors, composition, provisioning, and runtime boundaries
- `./references/guide-error-handling.md` for defining errors, schema-based errors, failure handling, defects, and interrupts
- `./references/guide-layers.md` for services, layer construction, composition, and provisioning patterns
- `./references/guide-observability.md` for `Effect.fn`, spans, logging, metrics, and telemetry wiring
- `./references/guide-retries.md` for retry policies, retry conditions, fallback strategies, and `ExecutionPlan`
- `./references/guide-schedule.md` for retries, repeats, backoff, polling, cron, and schedule composition
- `./references/guide-schema.md` for schema design, transformations, unions, recursion, opaque/branded types, and schema best practices
- `./references/guide-sql.md` for Effect SQL usage, transactions, resolvers, schema-aware SQL, and migrations
- `./references/guide-testing.md` for detailed `@effect/vitest` usage, layered test setup, property tests, and test services

These guides should be treated as the default implementation guidance. Do not skip them and jump straight to `./.repos/effect` unless you need source-level confirmation or the guides do not answer the question.

## Effect Principles

Apply these core principles when writing Effect code.

## Installation

When installing Effect packages in a user repository:

- use `effect@latest`
- keep all `@effect/*` packages on aligned versions
- install only the packages needed for the user's runtime and actual task

### Version Rules

- `effect` should be installed as the latest stable version
- all `@effect/*` packages must use the **same version number** as `effect` (unified versioning)
- do not mix unrelated `@effect/*` versions in the same project

### Unified Versioning

All Effect ecosystem packages share a **single version number**. Installing `effect@latest` ensures all runtime and integration packages (`@effect/platform-node`, `@effect/vitest`, etc.) are version-aligned.

Previously separate packages have been consolidated into `effect`:
- `@effect/platform`, `@effect/rpc`, `@effect/cli`, `@effect/experimental`, `@effect/typeclass` → merged into `effect`
- Their modules now live under `effect/unstable/*` import paths

### Package Selection

Choose packages based on the runtime and the work being done.

- core library: `effect@latest`
- Node.js runtime needs: `@effect/platform-node`
- browser runtime needs: `@effect/platform-browser`
- Bun runtime needs: `@effect/platform-bun`
- Vitest integration needs: `@effect/vitest`
- OpenTelemetry integration needs: `@effect/opentelemetry`
- SQL driver needs: `@effect/sql-pg`, `@effect/sql-sqlite-node`, etc.
- AI provider needs: `@effect/ai-openai`, `@effect/ai-anthropic`, etc.

Install additional `@effect/*` packages only when the user task actually needs them.

### Practical Rule

- start with `effect@latest`
- add `@effect/*` packages as needed by runtime and features
- keep versions aligned across all `@effect/*` packages

### Error Handling

- Use Effect's typed error system instead of throwing exceptions.
- Define descriptive error types with proper error propagation.
- Prefer `Schema.TaggedErrorClass` when the error can be schema-defined.
- Use `Effect.fail`, `Effect.catchTag`, and `Effect.catch` for error control flow.
- Use `Effect.catch`, `Effect.catchCause`, `Effect.catchDefect`, `Effect.catchFilter`, and `Effect.catchCauseFilter` for error recovery.
- Use `catchReason` / `catchReasons` for nested error reasons, `catchEager` for sync recovery.
- Stream: use `Stream.catch`, `Stream.catchFilter`, `Stream.result`, `Stream.fromArray`, `Stream.mapArray`.

### Dependency Injection

- Implement dependency injection using services and layers.
- Define services with `Context.Service` class syntax: `class Svc extends Context.Service<Svc, Shape>()("Svc") {}` or the function syntax with `use` / `make`.
- Fiber-local state uses `Context.Reference`, exported from `References`.
- Compose layers with `Layer.mergeAll` and `Layer.provide`.
- Use `Effect.provide` to inject dependencies at the edge, avoid providing locally.
- Keep services encapsulated; avoid exporting trivial accessor wrappers that only forward to one service method.

### Composability

- Leverage Effect composability for complex operations.
- Use appropriate constructors such as `Effect.succeed`, `Effect.fail`, `Effect.tryPromise`, `Effect.try`, and `Effect.sync`.
- Apply proper resource management with scoped effects.
- Chain operations with `Effect.flatMap`, `Effect.map`, `Effect.tap`, and `Effect.andThen`.
- Use `Effect.result` for absorbing errors into the value channel.
- Use `Effect.forkChild` and `Effect.forkDetach` for forking.
- Ref/Deferred/Fiber are no longer Effect subtypes — use `Ref.get`, `Deferred.await`, `Fiber.join` explicitly.

### Business Logic Functions

- Prefer `Effect.fn` for reusable business-logic functions that return `Effect`.
- Prefer `Effect.fn` over raw `Effect.gen` definitions even when the function takes no arguments.
- If you do not want an explicit named span, use `Effect.fn` without a span name.
- Do not use `Effect.fnUntraced` as the default.
- Use `Effect.fnUntraced` only for edge cases with a concrete low-level reason, such as measured hot-path overhead.

### Time and Clock

- Use `Clock` / `TestClock` for all time-based operations, never `Date.now()` or `new Date()`.
- Use `Effect.sleep` instead of `setTimeout`.
- This preserves referential transparency, testability with `TestClock`, and deterministic execution.

### TypeScript Preferences

- Never use `any`.
- Never use `as` casts.
- Never use unsafe type assertions or escape hatches.
- Never use `namespace`.
- Prefer correct typing, schema-driven decoding, narrowing, and proper generic constraints instead of forcing types.
- If a value comes from an external boundary, validate or decode it instead of asserting its type.
- If a type is hard to express, simplify the design or introduce a properly typed helper instead of using unsafe TypeScript.
- For layers, do not hide them inside `namespace` blocks. Prefer either `static` members on the service class or plain exported layer constants.

### Code Quality

- Write type-safe code that leverages Effect's type system.
- Use `Effect.gen` for readable sequential code.
- Implement proper testing patterns using Effect testing utilities.
- Prefer existing Effect primitives before introducing custom helpers.
- Prefer `Schema.Class` / `Schema.TaggedClass` / `Schema.TaggedErrorClass` variants over plain `Schema.Struct` for named reusable schemas when possible.
- Use `Union([A, B])`, `Tuple([A, B])` syntax, `check(makeFilter(...))` for filtering.
- Drop the `FromSelf` suffix on schema primitives (e.g. `BigIntFromSelf` → `BigInt`).

### Explaining Solutions

When providing solutions, explain the Effect concepts being used and why they fit the specific use case. If you encounter patterns not covered in local references, prefer consistency with the codebase when possible and otherwise rely on the vendored Effect source.

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
