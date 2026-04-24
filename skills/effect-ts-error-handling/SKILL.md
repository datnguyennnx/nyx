---
name: effect-ts-error-handling
description: Implement proper error handling with typed domain errors, boundary mapping, and bounded recovery strategies.
---

# Purpose
This skill ensures Effect-TS code uses proper error handling with typed domain errors, distinguishes expected vs unexpected errors, maps infrastructure errors to domain boundaries, and applies appropriate recovery strategies.

# Use when
Reviewing Effect-TS code to:
- Replace generic Error handling with typed domain errors using Effect.TaggedError
- Establish clear expected/unexpected error separation at type level
- Map infrastructure errors (HTTP, database) to domain errors at system boundaries
- Apply retry, timeout, and fallback policies with proper bounds and conditions
- Eliminate catch-all misuse that hides real problems or prevents proper error propagation

# Inputs
- Effect-TS source files (.ts, .tsx)
- Error type definitions and usage
- Catch/error handling blocks (Effect.catchAll, Effect.catchTag, etc.)
- Retry and timeout configurations (Effect.retry, Effect.timeout, Effect.schedule*)
- Infrastructure boundary code (HTTP clients, database access, file systems, etc.)
- Error transformation patterns (Effect.mapError, Effect.mapLeft)

# Core principles
- Expected errors belong in the error channel as typed values (Effect<A, E, R> where E ≠ never)
- Unexpected errors (defects) should be logged and cause termination unless at execution boundaries
- Domain errors should be modeled as tagged errors extending Effect.TaggedError for pattern matching
- Infrastructure errors should be mapped to domain errors at system boundaries, not allowed to leak outward
- Recovery strategies (retry, timeout, fallback) must be policy-based, bounded, and appropriate to the operation
- Error information should be preserved when transformation is needed for debugging/context

# Preferred patterns
- Create domain error classes: class NotFoundError extends Effect.TaggedError<NotFoundError>('NotFoundError')<{ id: string }>{}
- Use Effect.mapError/Effect.mapLeft for error transformation at boundaries: effect.pipe(Effect.mapError(mapHttpToDomainError))
- Apply Effect.retry with specific schedules: Effect.retry({ schedule: Schedule.exponential({ base: '100ms', maxRetries: 3 }) })
- Use Effect.timeout with appropriate durations: Effect.timeout('5 seconds') or Effect.timeoutFail
- Implement fallback with Effect.orElse or Effect.orElseSucceed for safe defaults
- Use Effect.sandbox to preserve defect information when logging unexpected errors at boundaries
- Leverage Effect.catchAll only at top-level boundaries (main, workers) for logging before termination
- Use Effect.catchTag/catchTags for specific error handling: effect.pipe(Effect.catchTag('NotFoundError', handleNotFound))

# Anti-patterns
- Generic Error catches: catch (error) => ... or Effect.catchAll(() => recover) without rethrowing defects
- Throwing unknown Error: throw new Error("message") instead of typed domain errors
- Catch-all without defect preservation: Effect.catchAll(() => recoverableEffect) that hides bugs
- Unbounded retry: Effect.retry(*) without schedule limits or maxRetries
- Ignoring unexpected errors: swallowing defects with Effect.catchAll(() => Effect.void) without logging
- Losing error information: mapping all infrastructure errors to single generic domain error losing debugging value
- Retrying non-idempotent operations: applying retry to POST/PUT/DELETE without checking idempotency
- Using retry as a substitute for proper error handling: retrying instead of fixing root causes or using timeouts

# Workflow
1. Identify all error handling blocks (catch, try/catch, Effect.catchAll/Effect.catchTag)
2. Check for generic Error usage and recommend Effect.TaggedError alternatives with proper fields
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

# Delegation
Delegate to:
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