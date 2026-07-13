---
name: effect-ts-design-patterns
description: Architecture patterns for Effect — Repository, UseCase/Service, CQRS-lite, Event Sourcing, DDD Layering, Module Structure, Config-Driven Layers.
---

## Rules

| Rule | Principle |
|---|---|
| Services declare WHAT; Layers wire HOW | Service interface Requirements = `never`. Dependencies live in Layer construction. |
| 1 domain responsibility = 1 service | Split if doing 2+ unrelated things. Orchestrators → Application layer. |
| Layers compose; services don't inherit | No class inheritance. Compose via `Layer.merge` / `Layer.provide`. |
| CQS is default; CQRS is upgrade | Query returns data. Command returns `void`. Split only when read/write diverge in optimization needs. |
| State changes are data | Event Sourcing = immutable event stream. Use only when audit trail or temporal queries needed. |
| Domain never imports Infrastructure | Dependencies: Infrastructure → Application → Domain. Domain imports only `effect/*` + `@effect/schema`. |
| Configuration is a dependency | Never `process.env` in domain/application. Inject via `Config` service + Layer (`Config` module, not process.env). |

## Patterns

### Repository
Abstract data access behind service interface (`Context.Service` class syntax):
```ts
class UserRepository extends Context.Service<UserRepository, {
  readonly findById: (id: string) => Effect<Option<User>, never, never>
  readonly save: (user: User) => Effect<void, never, never>
}>()("UserRepository") {}
```
Domain types only in interface. Implementation deps in Layer, not interface.

### UseCase / Service
One use case = one flow. Verb-noun naming: `CreateOrder`, `CancelSubscription`. Noun-only for domain services: `UserRepository`, `PaymentGateway`.
Each use case depends on multiple domain services through its Layer. The use case is pure orchestration — calls domain services in sequence, applies business rules, maps errors.

### CQRS-lite
Reads: `queries/` subdirectory, return data, cacheable, no side effects.
Writes: `commands/` subdirectory, return `void | Id`, validate + enforce rules + persist.
Upgrade to full CQRS only when read/write models diverge in storage, caching, or consistency.

### Event Sourcing
Events = `Schema.TaggedErrorClass` with timestamp. State = fold over event stream.
Use `Effect.acquireRelease` for event store. Use `Stream.runFold` for state rebuild.
Events are immutable records — never mutate, only append.

### DDD Layering
```
src/domain/       # Entities, tags, errors — zero infrastructure imports
src/application/  # Use cases, orchestration — imports Domain only
src/infrastructure/ # Concrete implementations — imports Domain + Application
```
Domain layer: zero imports from infrastructure. Only imports `effect` and `effect/Schema`.
Application layer: imports Domain. Orchestrates domain services.
Infrastructure layer: provides `Layer.effect` implementations.

### Module Structure
```
services/users/
  user.ts              # Entity + Schema
  user-repository.ts   # Context.Service tag only (interface)
  user-repository-live.ts  # Layer.effect implementation
  user-repository-test.ts  # Layer.succeed test implementation
  errors.ts            # Schema.TaggedErrorClass types
```
One file per concern: tag, layer, errors, schema.

### Config-Driven Layers
```ts
class AppConfig extends Context.Service<AppConfig, {
  readonly dbHost: string; readonly dbPort: number
}>()("AppConfig") {}

const AppConfigLive = Layer.effect(AppConfig, Effect.gen(function* () {
  const dbHost = yield* Config.string("DB_HOST")  // Config module
  return AppConfig.of({ dbHost, dbPort: 5432 })
}))
```
All layers depend on `AppConfig`. Tests swap with `Layer.succeed`.

## Anti-patterns

| Pattern | Severity |
|---|---|
| Service method Requirements ≠ `never` (leaking construction deps) | HIGH |
| Domain layer importing `pg`, `fs`, `axios` | HIGH |
| `process.env` outside dedicated Config layer | HIGH |
| `Context.Tag` / `Effect.Tag` service definition | HIGH |
| Event Sourcing for entities without audit/temporal need | HIGH |
| Per-request `Effect.provide(effect, AppLayer)` in hot path | HIGH |
| 15+ methods on single service tag spanning unrelated domains | MEDIUM |
| `Layer.succeed` for resources needing cleanup | MEDIUM |
| Infrastructure error types in domain return types | MEDIUM |
| Premature CQRS split without divergence evidence | MEDIUM |
| Config reads scattered across infrastructure files | LOW |
| One file per function (module proliferation) | LOW |

## Guardrails
- Start simple. CQS before CQRS. Single-layer before DDD.
- Pattern selection proportional to problem. No Event Sourcing without business case.
- Smallest change that solves the problem. Don't prescribe full DDD for a 2-service app.
- Respect existing conventions unless they conflict with Effect principles.
- Auto-memoization is default. Use `{ local: true }` only when per-request isolation needed.
