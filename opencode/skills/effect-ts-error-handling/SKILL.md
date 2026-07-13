---
name: effect-ts-error-handling
description: Typed domain errors, boundary mapping, bounded recovery strategies — Effect error handling.
---

## Core Principles

- Expected errors in error channel as typed values (`Effect<A, E, R>` where E ≠ never)
- Unexpected errors (defects) logged and cause termination unless at execution boundaries
- Domain errors modeled as tagged errors: `Schema.TaggedErrorClass` or `Data.TaggedError`
- Infrastructure errors mapped to domain errors at system boundaries — never leak outward
- Recovery strategies (retry, timeout, fallback) must be policy-based, bounded, and idempotency-aware
- Cause structure is FLAT: iterate via `for (const reason of cause.reasons)` with `reason._tag "Fail" | "Die" | "Interrupt"`

## Preferred Patterns

| Pattern | Implementation |
|---|---|
| Domain errors | `class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()("NotFoundError", { id: Schema.String }) {}` |
| Boundary mapping | `effect.pipe(Effect.catchTag("HttpError", mapHttpToDomainError))` |
| Bounded retry | `Effect.retry({ schedule: Schedule.exponential({ base: '100ms', maxRetries: 3 }) })` |
| Timeout | `Effect.timeout('5 seconds')` or `Effect.timeoutFail` |
| Fallback | `Effect.orElse` / `Effect.orElseSucceed` for safe defaults |
| Defect preservation | `Effect.sandbox` at entry points to log unexpected errors |
| Specific catch | `Effect.catchTag("NotFoundError", handler)` |
| Generic catch | `Effect.catch(() => recover)` |
| Error absorption | `Effect.result` to convert failures to values |
| Catch with filter | `Effect.catchFilter((e) => e._tag === "NotFound")` |

## Anti-patterns

| Pattern | Detect | Severity |
|---|---|---|
| Generic Error catches | `catch (error)` / `Effect.catch(() => ...)` without rethrowing defects | HIGH |
| Catch-all swallowing defects | `Effect.catch(() => Effect.void)` without logging | HIGH |
| Unbounded retry | Retry without maxRetries or duration limit | HIGH |
| Retrying non-idempotent ops | Retry on POST/PUT/DELETE without idempotency check | HIGH |
| Losing error information | Mapping all errors to single generic domain error | MEDIUM |
| Missing boundary mapping | Infrastructure errors (HTTP, DB) leaking to domain layer | MEDIUM |
| Retry as error handling substitute | Retrying instead of fixing root cause or using timeouts | LOW |

## Severity

| Level | Criteria |
|---|---|
| HIGH | Silent error swallowing, unbounded retry, defect information loss, API that won't compile |
| MEDIUM | Generic Error where typed is appropriate, missing boundary mapping |
| LOW | Over-specified retry without evidence, minor implementation detail leak |

## Output per finding
- File:line location
- Error handling issue (from table)
- Recommended typed/bounded alternative
- Risk level

## Guardrails
- Never remove error logging or monitoring for unexpected errors.
- Preserve error semantics when transforming — don't lose debugging info.
- Avoid over-specifying retry without evidence of need or idempotency consideration.
- Infrastructure errors are appropriate at their own boundary until mapped to domain.
