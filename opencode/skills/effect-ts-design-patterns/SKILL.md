---
name: effect-ts-design-patterns
description: Architecture patterns — Repository, UseCase/Service, CQRS, Event Sourcing, DDD Layering, Config-Driven Layers. Concern-specific add-on.
---

## Rules

| Rule | Principle |
|---|---|
| Services declare WHAT; Layers wire HOW | Service Requirements = `never`. Dependencies in Layer construction. |
| 1 domain = 1 service | Split if doing 2+ unrelated things. Orchestrators → Application layer. |
| Layers compose; services don't inherit | No class inheritance. Compose via `merge`/`provide`. |
| CQS default; CQRS upgrade | Query returns data. Command returns void. Split only when read/write diverge. |
| State changes are data | Event Sourcing only when audit trail or temporal queries needed. |
| Domain never imports Infrastructure | Dependencies: Infra → Application → Domain. |
| Configuration is a dependency | Never `process.env`. Inject via `Config` service + Layer. |

## Patterns

### Repository
```ts
class UserRepository extends Context.Service<UserRepository, {
  readonly findById: (id: string) => Effect<Option<User>, never, never>
  readonly save: (user: User) => Effect<void, never, never>
}>()("UserRepository") {}
```
Domain types only in interface. Implementation deps in Layer.

### UseCase
One flow = one use case. Verb-noun: `CreateOrder`. Pure orchestration — calls domain services, maps errors.

### CQRS-lite
Reads: `queries/`, return data, cacheable. Writes: `commands/`, return `void | Id`. Upgrade only when models diverge.

### Event Sourcing
Events = `Schema.TaggedErrorClass` with timestamp. State = fold over event stream. Immutable — append only.

### DDD Layering
```
src/domain/       # Entities, tags, errors — zero infra imports
src/application/  # Use cases, orchestration — imports Domain
src/infrastructure/ # Concrete implementations
```

### Config-Driven
```ts
class AppConfig extends Context.Service<AppConfig, { readonly dbHost: string }>()("AppConfig") {}
const Live = Layer.effect(AppConfig, Effect.gen(function*() {
  return AppConfig.of({ dbHost: yield* Config.string("DB_HOST") })
}))
```

## Anti-Patterns (HIGH)

| Pattern | Severity |
|---|---|
| Service method Requirements != `never` | HIGH |
| Domain importing `pg`/`fs`/`axios` | HIGH |
| `process.env` outside dedicated Config layer | HIGH |
| `Context.Tag` / `Effect.Tag` service definition | HIGH |
| Event Sourcing without audit/temporal need | HIGH |
| Per-request `Effect.provide(effect, AppLayer)` in hot path | HIGH |

## Mid/Low Anti-Patterns

| Pattern | Severity |
|---|---|
| 15+ methods on single tag spanning unrelated domains | MEDIUM |
| `Layer.succeed` for resources needing cleanup | MEDIUM |
| Infrastructure error types in domain return types | MEDIUM |
| Premature CQRS without divergence evidence | MEDIUM |
| Config reads scattered across infra files | LOW |

## Guardrails

- Start simple: CQS before CQRS, single-layer before DDD.
- Smallest change that solves the problem.
- Auto-memoization is default. `{ local: true }` only for per-request isolation.
