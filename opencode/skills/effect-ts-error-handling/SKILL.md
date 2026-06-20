---
name: effect-ts-error-handling
description: Typed domain errors, boundary mapping, bounded recovery strategies — Effect-TS v4 error handling.
---

## v4 Renames

| v3 | v4 |
|---|---|
| `catchAll` | `catch` |
| `catchAllCause` | `catchCause` |
| `catchAllDefect` | `catchDefect` |
| `catchSome` | `catchFilter` |
| `catchSomeCause` | `catchCauseFilter` |
| `catchSomeDefect` | DELETED |
| `either` | `result` |

## Core Principles

- Expected errors in error channel as typed values (`Effect<A, E, R>` where E ≠ never)
- Unexpected errors (defects) logged and cause termination unless at execution boundaries
- Domain errors modeled as tagged errors: `Schema.TaggedErrorClass` or `Data.TaggedError`
- Infrastructure errors mapped to domain errors at system boundaries — never leak outward
- Recovery strategies (retry, timeout, fallback) must be policy-based, bounded, and idempotency-aware
- Cause structure is FLAT in v4: iterate via `for (const reason of cause.reasons)` with `reason._tag "Fail" | "Die" | "Interrupt"`

## Preferred Patterns (v4)

| Pattern | Implementation |
|---|---|
| Domain errors | `class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()("NotFoundError", { id: Schema.String }) {}` |
| Boundary mapping | `effect.pipe(Effect.catchTag("HttpError", mapHttpToDomainError))` |
| Bounded retry | `Effect.retry({ schedule: Schedule.exponential({ base: '100ms', maxRetries: 3 }) })` |
| Timeout | `Effect.timeout('5 seconds')` or `Effect.timeoutFail` |
| Fallback | `Effect.orElse` / `Effect.orElseSucceed` for safe defaults |
| Defect preservation | `Effect.sandbox` at entry points to log unexpected errors |
| Specific catch (v4) | `Effect.catchTag("NotFoundError", handler)` — v4 `catchTag` unchanged |
| Generic catch (v4) | `Effect.catch(() => recover)` — was `catchAll` in v3 |
| Error absorption | `Effect.result` (was `either`) to convert failures to values |
| Catch with filter (v4) | `Effect.catchFilter((e) => e._tag === "NotFound")` — was `catchSome` |

## Anti-patterns

| Pattern | Detect | Severity |
|---|---|---|
| v3 API usage | `catchAll`, `catchSome`, `catchAllCause`, `catchAllDefect`, `either` | HIGH |
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
| HIGH | Silent error swallowing, unbounded retry, defect information loss, v3 API won't compile |
| MEDIUM | Generic Error where typed is appropriate, missing boundary mapping |
| LOW | Over-specified retry without evidence, minor implementation detail leak |

## Output per finding
- File:line location
- Error handling issue (from table)
- Recommended typed/bounded alternative with v4 API
- Risk level

## Guardrails
- Never remove error logging or monitoring for unexpected errors.
- Preserve error semantics when transforming — don't lose debugging info.
- Avoid over-specifying retry without evidence of need or idempotency consideration.
- Infrastructure errors are appropriate at their own boundary until mapped to domain.
