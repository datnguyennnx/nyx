---
name: effect-ts-error-handling
description: Typed domain errors, boundary mapping, bounded recovery. Concern-specific add-on.
---

## Principles

- Expected errors in error channel as typed values (`Effect<A,E,R>`, E≠never)
- Unexpected errors (defects) logged at execution boundaries
- Domain errors = `Schema.TaggedErrorClass` or `Data.TaggedError`
- Infrastructure errors mapped to domain at system boundaries
- Recovery must be policy-based, bounded, idempotency-aware

## Preferred Patterns

| Pattern | Implementation |
|---|---|
| Domain errors | `class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()("NotFoundError", { id: Schema.String }) {}` |
| Boundary mapping | `Effect.catchTag("HttpError", mapHttpToDomainError)` |
| Bounded retry | `Effect.retry({ schedule: Schedule.exponential({ base: '100ms', maxRetries: 3 }) })` |
| Timeout | `Effect.timeout('5 seconds')` |
| Fallback | `Effect.orElse` / `Effect.orElseSucceed` |
| Defect preservation | `Effect.sandbox` at entry points |
| Error absorption | `Effect.result` |

## Anti-Patterns

| Pattern | Severity |
|---|---|
| Generic `catch` without rethrowing defects | HIGH |
| Catch-all swallowing defects without logging | HIGH |
| Unbounded retry (no maxRetries) | HIGH |
| Retrying non-idempotent ops (POST/PUT/DELETE) | HIGH |
| Losing error info (all errors → single generic error) | MEDIUM |
| Missing boundary mapping (infra errors leaking to domain) | MEDIUM |
| Retry as error handling substitute | LOW |

## Guardrails

- Never remove error logging for unexpected errors.
- Preserve error semantics when transforming.
- Infrastructure errors are appropriate at own boundary until mapped to domain.
