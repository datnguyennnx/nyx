---
name: effect-ts-design-patterns
description: Common architecture patterns for Effect-TS applications: Repository, UseCase/Service, CQRS-lite, Event Sourcing basics, DDD Layering, Module Structure, and Config-Driven Layers.
---

# Companion Skill
Load `effect-ts-principle-thinking` alongside this skill as the exclusive source of truth for core mental models (Programs as Values, Edge of the World, Structured Concurrency, Contextual DI). Load `effect-ts` for research strategy, installation guidance, and reference guides. This skill provides architectural pattern guidance on top of those foundations — it does not replace them. All pattern recommendations here assume the core mental models from `effect-ts-principle-thinking` are already in effect.

# Purpose
This skill provides a catalog of proven architecture patterns for structuring Effect-TS applications. It answers the question "How do I organize services, layers, and modules so my application scales in complexity without collapsing into spaghetti?" rather than "How do I use the Effect API?" Each pattern is presented with the scenario that calls for it, the trade-offs it makes, and concrete structural guidance. The goal is to give developers and agents a shared vocabulary for architectural decisions.

# Use when
- Designing the high-level module structure of a new Effect-TS application.
- Deciding whether and how to abstract data access behind a service interface.
- Separating read and write responsibilities within a domain.
- Modeling domain state changes as an event log.
- Organizing services into DDD-aligned layers (Domain, Application, Infrastructure).
- Deciding where to put files, layers, and error types.
- Wiring configuration into services without leaking env-var handling into domain logic.
- Reviewing an existing codebase for structural anti-patterns.
- Mentoring teams on Effect-TS architecture conventions.

# Inputs
- Service interface definitions (Context.Tag or Effect.Service declarations).
- Layer composition graphs (which layers depend on which).
- Module directory structure and file organization.
- Domain model types and Schema definitions.
- Error type hierarchies and typed error flows.
- Configuration sourcing strategy (env vars, config files, etc.).
- Test strategy: how services are mocked or replaced in tests.

# Core principles (storytelling narrative)

1. **Services declare WHAT; Layers wire in HOW.** When you define a service interface with a `Context.Tag`, you are drawing a contract: "I need this capability." The Layer is the constructor that fulfills that contract. The service interface must never mention its own construction dependencies. If your service method signature has anything other than `never` in the Requirements parameter, you are leaking implementation details. The story goes: the domain expert dictates what operations exist; the infrastructure engineer decides how to build them. These two roles meet at the service boundary, and Layers are the glue that keeps them from contaminating each other.

2. **One domain responsibility = one service.** A service should encapsulate exactly one coherent responsibility from the domain's perspective. `UserRepository` handles user persistence. `OrderProcessor` handles order lifecycle. `NotificationSender` sends notifications. When a service starts doing two things (e.g., `UserAndOrderService`), you have crossed the threshold from service into orchestrator — and orchestrators belong in the Application layer, not in the Domain layer. This principle mirrors the Single Responsibility Principle but framed in terms of domain semantics: a service is the mouthpiece for one domain concept.

3. **Layers compose; services don't inherit.** There is no class inheritance in Effect service design. A service is a tag + an object. Composition happens at the Layer level using `Layer.merge` and `Layer.provide`. If you feel the urge to extend a base service, you are likely missing a smaller abstraction. Instead, define a smaller service and compose it into the dependent layer. The mental model: services are LEGO bricks; Layers are the instructions for which bricks snap into which.

4. **CQS is the default; CQRS is the upgrade.** By default, every service method either returns data (a query) or performs a mutation (a command). Queries are `Effect<Data, Error, never>`. Commands are `Effect<void, Error, never>` (or `Effect<Id, Error, never>` if you return the created entity's ID). This is Command-Query Separation (CQS). When reads and writes grow sufficiently different in their optimization needs (different data stores, different caching strategies, different consistency models), you split them into separate services — that is CQRS. Start with CQS. Upgrade to CQRS only when the read and write sides have diverged in their non-functional requirements.

5. **State changes are data.** Event Sourcing models state as a sequence of immutable facts. Each event is a `Schema`-validated record that something happened. The current state is a derived value — a fold over the event stream. This pattern is not for every entity. Use it when you need an audit log, temporal queries ("what did the system look like on Tuesday?"), or when the event stream itself is a valuable output (analytics, projections, integration events). Effect's `Stream` and `Schema` make event sourcing natural: events are Schema-validated, the event log is a Stream, and state rebuilding is a `Stream.runFold`.

6. **Domain never imports Infrastructure.** This is the foundational rule of DDD layering. The Domain layer defines types, service interfaces (tags), and business rules. It imports nothing from `fs`, `http`, `pg`, or any infrastructure module. The Application layer imports Domain and defines use cases (orchestration logic). The Infrastructure layer imports Domain and Application and provides the concrete implementations. Dependencies point inward: Infrastructure → Application → Domain. Nothing points outward. If you see a `Context.Tag` definition in a file that also imports a database driver, you have a layering violation.

7. **Configuration is a dependency, not a global.** Environment variables, config files, and secrets are external inputs that must be injected through Layers — the same as any other dependency. Use a `Config` service or `Layer` constructors that read from `Config` (the Effect module). Never call `process.env` directly in domain logic, application logic, or even infrastructure implementation constructors. Config is just another service with a `Layer`; it gets provided at the edge alongside everything else. This keeps code testable (swap config layers in tests) and prevents implicit coupling to the execution environment.

# Preferred patterns

### 1. Repository Pattern
Abstract data access behind a service interface. The interface defines domain-level operations (`findById`, `save`, `delete`). Layers provide concrete implementations (Postgres, InMemory, REST, Mock).

```
class UserRepository extends Context.Tag("UserRepository")<
  UserRepository,
  {
    readonly findById: (id: UserId) => Effect<Option<User>, never, never>
    readonly save: (user: User) => Effect<void, never, never>
    readonly delete: (id: UserId) => Effect<void, never, never>
  }
>() {}
```

The Repository interface must use domain types only (`UserId`, `User`). Never expose database concepts (SQL, connection pools, query builders) through the interface. The Layer that constructs the Postgres implementation depends on a `DatabaseConnection` service — but that dependency lives in the Layer, not the Repository interface.

### 2. UseCase / Service Pattern
Organize business logic into focused use-case services in the Application layer. Each use case is a single function or class that orchestrates one flow.

```
class CreateOrder extends Context.Tag("CreateOrder")<
  CreateOrder,
  {
    readonly execute: (input: CreateOrderInput) => Effect<Order, OrderDomainError, never>
  }
>() {}
```

A use case depends on multiple domain services (repositories, domain services) through its Layer. The `CreateOrderLive` layer yields `UserRepository`, `OrderRepository`, `ProductRepository`, and `PaymentGateway` to construct the use case. The use case itself is pure orchestration — it calls domain services in sequence, applies business rules, and maps errors.

Naming convention: verb-noun for use cases (`CreateOrder`, `CancelSubscription`, `ProcessRefund`), noun-only for domain services (`UserRepository`, `PaymentGateway`, `NotificationSender`).

### 3. CQRS-lite
Separate read and write responsibilities at the service level without introducing separate data stores or event buses.

Read services (queries):
- Return `Effect<Data, Error, never>` — no side effects.
- Accept filter, pagination, and sorting parameters as plain data.
- Can be cached aggressively.
- Live in a `*/queries/` subdirectory.

Write services (commands):
- Return `Effect<void | Id, DomainError, never>` — side effects expected.
- Validate input, enforce business rules, persist changes.
- Live in a `*/commands/` subdirectory.

When read and write shapes diverge significantly — e.g., reads need denormalized projections, writes need transactional consistency — promote to full CQRS with separate models and potentially separate stores. Effect's `Stream` and `Ref` make in-memory read models straightforward.

### 4. Event Sourcing basics
Model state changes as an immutable sequence of events. Current state is a fold over the event stream.

Event definition (using Schema):
```
class OrderCreated extends Schema.TaggedError<OrderCreated>()("OrderCreated", {
  orderId: Schema.String,
  customerId: Schema.String,
  items: Schema.Array(Schema.String),
  timestamp: Schema.DateTimeUtc,
}) {}
```

Aggregate root:
```
const rebuildState = (events: ReadonlyArray<OrderEvent>): OrderState =>
  events.reduce((state, event) => applyEvent(state, event), initialState)
```

Use `Effect.acquireRelease` for the event store connection wrapped in a Layer. Read from `Stream<OrderEvent, never, ...>` to feed projections. Use `Stream.runFold` to rebuild state on startup. Events are immutable records — never mutate, only append.

### 5. DDD Layering
Three layers with strict dependency direction.

```
src/
  domain/          # Domain layer — pure business logic
    user.ts          # User entity, value objects
    user-repository.ts  # UserRepository tag (interface only)
    order.ts         # Order entity, domain events
    errors.ts        # UserNotFoundError, OrderValidationError

  application/     # Application layer — use cases, orchestration
    create-user.ts     # CreateUser use case
    place-order.ts     # PlaceOrder use case
    queries/
      get-user-by-id.ts
      list-orders.ts

  infrastructure/  # Infrastructure layer — concrete implementations
    postgres/
      user-repository.ts  # Layer.effect producing UserRepository
      order-repository.ts
      pg-pool.ts          # DatabaseConnection layer
    http/
      payment-gateway.ts
    config/
      app-config.ts       # Config service + Layer
```

Domain layer: zero imports from infrastructure. Only imports `effect/Schema`, `effect/Effect`, `effect/Context` for tags.

Application layer: imports Domain. Orchestrates domain services. Controllers/handlers live here if they are thin (parse input → call use case → format output).

Infrastructure layer: imports Domain and Application. Provides `Layer.effect` implementations. Contains database adapters, HTTP clients, file I/O.

### 6. Module Structure
Consistent file organization per service:

```
services/users/
  user.ts             # Domain entity + Schema
  user-repository.ts  # Tag definition only (interface)
  user-repository-live.ts   # Layer.effect for live implementation
  user-repository-test.ts   # Layer.succeed for test implementation
  errors.ts           # UserNotFoundError, DuplicateEmailError
  user-service.ts     # Domain service (if needed beyond CRUD)

application/users/
  create-user.ts      # Use case
  get-user.ts         # Query

infrastructure/
  postgres/
    user-repository-live.ts  # Concrete implementation
  config/
    app-config.ts
```

Module convention:
- One file for the service tag (interface). Export only the tag and its shape type.
- One file for the Layer implementation. Export `Live` and `Test` layers.
- One file for error types (TaggedError classes).
- One file for Schema definitions alongside domain types.

When using `Effect.Service`, the tag, layer, and accessors are collocated — this is acceptable when the service is small. For larger services, prefer the split-file approach to keep the interface readable.

### 7. Config-Driven Layers
Pass configuration through Layer dependencies. Never read `process.env` in domain or application code.

```
class AppConfig extends Context.Tag("AppConfig")<
  AppConfig,
  {
    readonly dbHost: string
    readonly dbPort: number
    readonly logLevel: string
  }
>() {}
```

Construction using Effect's `Config` module:
```
const AppConfigLive: Layer<AppConfig> = Layer.effect(
  AppConfig,
  Effect.gen(function* () {
    const dbHost = yield* Config.string("DB_HOST")
    const dbPort = yield* Config.integer("DB_PORT")
    const logLevel = yield* Config.string("LOG_LEVEL")
    return AppConfig.of({ dbHost, dbPort, logLevel })
  })
)
```

The `DatabaseConnection` layer depends on `AppConfig`. The `UserRepository` layer depends on `DatabaseConnection`. At the composition root, `AppConfigLive` is provided first, then everything else. In tests, swap `AppConfigLive` for a `Layer.succeed` with test values — no env vars needed.

For secrets, use a dedicated `Secrets` service that reads from a vault or encrypted store — again, through a Layer, never via `process.env` in application code.

# Anti-patterns

1. **Requirement Leakage in Service Interfaces.** Service methods that declare `Config | Logger | Database` in their `Effect` type's Requirements parameter instead of `never`. This forces every caller to carry those dependencies and makes testing unnecessarily complex. Fix: use Layers to absorb construction dependencies; keep the service interface's Requirements = `never`.

2. **Fat Services (Multiple Responsibilities).** A single service tag with 15+ methods spanning unrelated domains (e.g., `UserAndPaymentAndNotificationService`). This violates the one-responsibility principle and makes Layers impossible to compose independently. Fix: split into focused services, one per domain concept.

3. **Layer-as-Singleton Constructor.** Using `Layer.succeed` for services that need cleanup, connection pooling, or lifecycle management. `Layer.succeed` is for pure values only. For resources, use `Layer.effect` with `Effect.acquireRelease` so the resource is properly scoped and released. (See `effect-ts-resource-layer` skill for details.)

4. **Domain Layer Importing Infrastructure.** A domain entity file importing `pg`, `fs`, or `axios`. This breaks the DDD layering rule and makes the domain untestable without infrastructure. Fix: domain defines tags only; infrastructure provides implementations.

5. **In-Memory Repository as the Default.** Starting with an in-memory repository for "simplicity" and then struggling when switching to Postgres because the interface leaked in-memory assumptions (e.g., synchronous methods, mutable state exposed). Fix: design the repository interface from the perspective of a database, then provide an in-memory implementation that conforms to the same contract. Test with the in-memory implementation; run integration tests against the real one.

6. **CQRS Premature Split.** Splitting into separate read and write models before there is evidence that they diverge. This adds complexity (eventual consistency, separate stores) without benefit. Fix: start with CQS (same model, separate service methods). Split only when non-functional requirements diverge.

7. **Event Sourcing for Everything.** Applying event sourcing to entities that don't need audit trails, temporal queries, or event-driven projections. This adds immense complexity (event versioning, schema evolution, rebuilding state) for no benefit. Fix: use event sourcing only where the event stream provides business value beyond the current state.

8. **Config Sprawl.** Calling `Config.string("DB_HOST")` directly inside a repository implementation, scattering config reads across infrastructure files. Fix: centralize config reads in a dedicated `Config` layer. All other services depend on the `Config` tag, not on `Config.*` constructors.

9. **Module Proliferation.** One file per function, creating dozens of tiny files that are hard to navigate. Fix: group related functions into cohesive modules. Use the Module Structure pattern above as a guide — one file per service tag, one per layer, one per error module.

10. **Error Type Leakage.** Reusing infrastructure-level error types (e.g., `PgError`, `HttpError`) in domain service return types. Fix: define domain-specific error types (TaggedError classes). Map infrastructure errors to domain errors inside the Layer, before the error reaches the service boundary.

# Workflow

1. **Identify Domain Boundaries.** Start with the domain model. What are the entities, value objects, and domain services? Draw the bounded contexts. Each bounded context gets its own module tree under `src/`.

2. **Define Service Interfaces (Tags).** For each domain concept, define a `Context.Tag` with the minimal set of operations. Keep Requirements = `never` on all methods. Export only the tag and the shape type. Do not implement anything yet.

3. **Design the Layer Graph.** Draw the dependency graph: which services depend on which? Create a table: Service → Dependencies → Layer type. Identify shared infrastructure (config, database connection) that should be separate layers.

4. **Implement Infrastructure Layers.** For each service tag, create one or more Layer implementations. Use `Layer.succeed` for pure values, `Layer.effect` for effectful construction, `Layer.effect` + `Effect.acquireRelease` for resources with lifecycle.

5. **Wire the Composition Root.** Create a single `AppLayer` that composes all layers with `Layer.mergeAll` and `Layer.provide`. This is the only place where the full dependency graph is visible.

6. **Write Tests with Layer Replacement.** For each use case, write a test that provides `Layer.succeed` test implementations for every dependency. Use `Layer.provideMerge` to add mock layers on top of a minimal test layer set.

7. **Review Interface Purity.** Audit every service interface for requirement leakage. Confirm no method signature includes anything other than `never` in the Requirements position. Audit every domain entity file for infrastructure imports.

# Output contract
When applying this skill, produce findings with:
- Pattern name (e.g., "Repository Pattern", "DDD Layering").
- Current state description (with file:line evidence if available).
- Gap description: what the current code does wrong relative to the pattern.
- Correct pattern application: file structure, tag definition, layer composition.
- Migration path: minimal steps to move from current state to target state.

# Severity Criteria
- **HIGH:** Domain layer importing infrastructure modules (pg, fs, axios). Service method signatures leaking construction dependencies in Requirements parameter. Configuration scattered via `process.env` calls outside a dedicated Config layer. Event sourcing applied to entities with no business need for it.
- **MEDIUM:** Services with more than one domain responsibility. Layer implementations using `Layer.succeed` instead of `Layer.effect` for resources with lifecycle. Error types leaking infrastructure details into domain boundaries.
- **LOW:** Minor module organization issues (one file vs split files). Using `Effect.Service` for a large service that would benefit from split-file organization. CQS methods in the same service when CQRS would be clearer but not yet required.

# Acceptable Patterns (do NOT flag)
- `Layer.succeed` for injecting pure configuration objects, static values, or service stubs in tests.
- Using `Effect.Service` for small services (3-5 methods, few dependencies). The collocation of tag + layer is acceptable for simplicity.
- In-memory repositories for testing, as long as the interface was designed from the database perspective.
- Direct `Config.*` usage inside infrastructure Layer constructors (e.g., `Config.string("DB_HOST")` inside the `DatabaseConnectionLive` layer). This is acceptable because it is still inside the Layer, not the service interface.
- Synchronous helpers and pure functions in the Domain layer that don't use Effect at all. Pure functions are fine; they don't need to be wrapped in `Effect.sync` unless they perform side effects.
- Multiple services in the same file when they are small, closely related, and co-evolve (e.g., a query service and its corresponding response type).

# Related Guides (from effect-ts skill references/)
- `../effect-ts/references/guide-effect.md` — Core `Effect` usage, constructors, composition, provisioning, runtime boundaries
- `../effect-ts/references/guide-layers.md` — Services, layer construction, composition, provisioning patterns
- `../effect-ts/references/guide-error-handling.md` — Typed errors, boundary mapping, Error vs Defect
- `../effect-ts/references/guide-schema.md` — Schema definition, validation, transformation for domain events and DTOs

# Delegation
- Delegate to `effect-ts-principle-thinking` for core mental model questions (Programs as Values, Edge of the World, Structured Concurrency, Contextual DI). This is the exclusive source of truth.
- Delegate to `effect-ts` for research strategy, installation guidance, and general Effect API usage.
- Delegate to `effect-ts-resource-layer` for implementing `acquireRelease` specifics, resource lifecycle, and Scope management.
- Delegate to `effect-ts-error-handling` for typed error boundaries, TaggedError patterns, and error mapping between layers.
- Delegate to `effect-ts-anti-patterns` for low-level syntax checks (Promise-first code, hidden dependencies, oversized Effect.gen blocks).
- Delegate to `effect-ts-concurrency` for queue, semaphore, fiber, and streaming concurrency patterns.

# Guardrails
- This skill describes architecture patterns, not API syntax. Do not use it to dictate coding style or formatting preferences.
- Pattern selection must be proportional to the problem. Do not advocate for Event Sourcing or CQRS unless the business case is clear. Start simple (CQS, single layers) and upgrade as needed.
- Always reference `effect-ts-principle-thinking` for fundamental mental model enforcement. This skill only adds architectural pattern vocabulary on top.
- When recommending structural changes, prefer the smallest change that solves the actual problem. Do not prescribe full DDD layering if a two-service split is sufficient.
- Respect existing codebase patterns unless they are proven violations of Effect-TS principles. When a codebase uses a consistent convention (e.g., `Effect.Service` throughout), follow it rather than imposing a different style.
- Pattern guidance must be specific enough for tier-3 implementers to act on: include tag names, layer types, and file paths in recommendations.
