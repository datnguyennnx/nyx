---
name: effect-ts-error-handling
description: Implement proper error handling with typed domain errors, boundary mapping, and bounded recovery strategies.
---

# Companion Skill
Load `effect-ts` alongside this skill for research strategy, installation guidelines, and access to detailed reference guides (`../effect-ts/references/guide-error-handling.md`, `../effect-ts/references/guide-schema.md`, `../effect-ts/references/guide-retries.md`, `../effect-ts/references/guide-schedule.md`). The main `effect-ts` skill provides the canonical research methodology: local guides first → codebase patterns → Effect source code.

# Purpose
This skill ensures Effect-TS code uses proper error handling with typed domain errors, distinguishes expected vs unexpected errors, maps infrastructure errors to domain boundaries, and applies appropriate recovery strategies.

# Use when
Reviewing Effect-TS code to:
- Replace generic Error handling with typed domain errors using `Schema.TaggedErrorClass` (v4) or `Data.TaggedError`
- Establish clear expected/unexpected error separation at type level
- Map infrastructure errors (HTTP, database) to domain errors at system boundaries
- Apply retry, timeout, and fallback policies with proper bounds and conditions
- Eliminate catch-all misuse that hides real problems or prevents proper error propagation

# Inputs
- Effect-TS source files (.ts, .tsx)
- Error type definitions and usage
- Catch/error handling blocks (Effect.catch, Effect.catchAll (v3), Effect.catchTag, etc.)
- Retry and timeout configurations (Effect.retry, Effect.timeout, Effect.schedule*)
- Infrastructure boundary code (HTTP clients, database access, file systems, etc.)
- Error transformation patterns (Effect.mapError, Effect.mapLeft)

# Core principles
- Expected errors belong in the error channel as typed values (Effect<A, E, R> where E ≠ never)
- Unexpected errors (defects) should be logged and cause termination unless at execution boundaries
- Domain errors should be modeled as tagged errors using `Schema.TaggedErrorClass` (v4) or `Data.TaggedError` for pattern matching
- Infrastructure errors should be mapped to domain errors at system boundaries, not allowed to leak outward
- Recovery strategies (retry, timeout, fallback) must be policy-based, bounded, and appropriate to the operation
- Error information should be preserved when transformation is needed for debugging/context

# Preferred patterns
- Create domain error classes: `class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()("NotFoundError", { id: Schema.String }) {}` (v4) or `class NotFoundError extends Data.TaggedError("NotFoundError")<{ readonly id: string }> {}` (lightweight)
- Use Effect.mapError/Effect.mapLeft for error transformation at boundaries: effect.pipe(Effect.mapError(mapHttpToDomainError))
- Apply Effect.retry with specific schedules: Effect.retry({ schedule: Schedule.exponential({ base: '100ms', maxRetries: 3 }) })
- Use Effect.timeout with appropriate durations: Effect.timeout('5 seconds') or Effect.timeoutFail
- Implement fallback with Effect.orElse or Effect.orElseSucceed for safe defaults
- Use Effect.sandbox to preserve defect information when logging unexpected errors at boundaries
- Leverage Effect.catch (v4) / Effect.catchAll (v3) only at top-level boundaries (main, workers) for logging before termination
- Use Effect.catchTag/catchTags for specific error handling: effect.pipe(Effect.catchTag('NotFoundError', handleNotFound))

# Anti-patterns
- Generic Error catches: catch (error) => ... or Effect.catch(() => recover) without rethrowing defects
- Catch-all without defect preservation: Effect.catch(() => recoverableEffect) that hides bugs
- Ignoring unexpected errors: swallowing defects with Effect.catch(() => Effect.void) without logging
- Losing error information: mapping all infrastructure errors to single generic domain error losing debugging value
- Retrying non-idempotent operations: applying retry to POST/PUT/DELETE without checking idempotency
- Using retry as a substitute for proper error handling: retrying instead of fixing root causes or using timeouts

# Workflow
1. Identify all error handling blocks (catch, try/catch, Effect.catch/Effect.catchTag)
2. Check for generic Error usage and recommend `Schema.TaggedErrorClass` (v4) or `Data.TaggedError` alternatives with proper fields
3. Verify expected vs unexpected error separation by examining Effect<A, E, R> types in signatures
4. Examine infrastructure boundaries (HTTP clients, etc.) for proper error mapping to domain errors
5. Review retry/timeout configurations for bounding (max attempts, duration limits) and policy suitability
6. Ensure catch-all is only used at appropriate boundaries (process entry points) with defect logging
7. Validate that fallback strategies don't mask real problems and are used only for safe defaults
8. Check that error transformations preserve relevant information for debugging when needed

# Output contract
Return findings with:
- File location and line numbers
- Specific error handling issue (from anti-patterns list above)
- Explanation of why it violates Effect principles (type safety, information loss, etc.)
- Recommended typed error approach or recovery pattern with code example
- Risk level (low/medium/high)
- Verification notes for any Effect-TS claims made regarding error handling

# Severity Criteria
When assigning risk levels, use these definitions:
- **HIGH**: Silent error swallowing that hides bugs, unbound retry that can hang forever, defect information loss that prevents debugging — will cause production incidents
- **MEDIUM**: Generic Error usage where typed errors are appropriate, catch-all that doesn't preserve defects, missing error mapping at boundaries — wrong by convention but may work incidentally
- **LOW**: Over-specified retry policy without evidence of need, error type that leaks minor implementation detail — suboptimal but not dangerous

# Acceptable Patterns (do NOT flag)
These patterns are correct usage — do not flag them as anti-patterns:
- `Effect.catchTag` / `Effect.catchTags` for specific typed error handling — this IS the preferred pattern
- `Effect.catch` (v4) / `Effect.catchAll` (v3) at process entry points (main, workers) combined with defect logging — this IS appropriate boundary handling
- `Effect.mapError` for error transformation at domain boundaries — this IS proper error mapping
- `Effect.sandbox` / `Effect.unsandbox` for preserving defect information — this IS correct defect handling
- `Effect.retry` with bounded `Schedule` (exponential with maxRetries, spaced with maxRecurs) — this IS bounded retry
- `Effect.timeout` with explicit duration — this IS proper timeout bounding
- `Effect.orElse` / `Effect.orElseSucceed` for safe fallback strategies — this IS proper recovery
- `Effect.result` (v4) / `Effect.either` (v3) for converting failures to values at consumption points — this IS correct error absorption
- Infrastructure-level generic errors (database driver, HTTP client errors) at their own boundary — these ARE appropriate until mapped to domain errors

# Related Guides (from effect-ts skill references/)
- `../effect-ts/references/guide-error-handling.md` — Defining errors, schema-based errors, failure handling, defects
- `../effect-ts/references/guide-schema.md` — Schema design, tagged errors (`Schema.TaggedErrorClass`)
- `../effect-ts/references/guide-retries.md` — Retry policies, retry conditions, ExecutionPlan
- `../effect-ts/references/guide-schedule.md` — Retries, backoff, schedule composition

# Delegation
Delegate to:
- **effect-ts** for research strategy, installation guidelines, and in-depth guidance
- effect-ts-principle-thinking for mental model violations (swallowing error channel at boundary, Errors are Data violations)
- effect-ts-anti-patterns for generic Error detection and Promise-first code
- effect-ts-resource-layer for error handling in resource acquisition/release patterns
- effect-ts-concurrency for error handling in concurrent operations (racing, parallelism)

# Guardrails
- Never suggest removing error logging or monitoring for unexpected errors
- Preserve original error semantics when transforming (don't lose stack traces or debugging info)
- Avoid over-specifying retry policies without evidence of need or idempotency consideration
- Don't suggest domain error creation where infrastructure errors are appropriate (low-level drivers)
- Prevent creating error types that leak implementation details (database connection strings, etc.)
- Do not suggest eliminating recovery strategies entirely; instead recommend proper bounding