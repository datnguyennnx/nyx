---
name: effect-ts-principle-thinking
description: Enforce core Effect-TS mental models: Programs as Values, Edge of the World execution, Structured Concurrency, and Contextual Dependency Injection.
---

# Companion Skill
Load `effect-ts` alongside this skill for research strategy, installation guidelines, and access to detailed reference guides covering all Effect domains. The main `effect-ts` skill provides the canonical research methodology: local guides first → codebase patterns → Effect source code. This skill is the exclusive source of truth for core mental models; the main skill provides the general-purpose research framework and installation guidance.

# Purpose
This skill aligns architectural design and code implementation with the fundamental philosophies of Effect-TS. It ensures developers and agents think in terms of "Effects as descriptions of workflows" rather than immediate imperative executions, maintaining strict boundaries, resource safety, and deterministic control flow.

# Use when
- Designing new modules, microservices, or integrations (e.g., MCP servers, HTTP APIs).
- Reviewing architectural boundaries and framework bridging.
- Refactoring imperative or object-oriented code into Effect-TS.
- Auditing application entry points, lifecycle management, and global state.
- Evaluating how 3rd-party libraries are integrated into the Effect ecosystem.

# Inputs
- Application entry points (`main.ts`, `server.ts`).
- Framework bridging layers (Express/Fastify handlers, MCP protocol handlers).
- High-level architecture and Domain-Driven Design (DDD) layers.
- Background worker and daemon configurations.

# Core principles
- **Programs as Values:** `Effect` instances are lazy descriptions of workflows. They do nothing until explicitly executed by a Runtime.
- **The Edge of the World:** Execution (`Effect.runPromise`, `NodeRuntime.runMain`) must be pushed to the absolute outer boundary of the application.
- **Managed Framework Bridging:** When interfacing with external callback-based or Promise-based frameworks (like MCP, Express), use `ManagedRuntime` to share a single initialized dependency graph rather than running effects in isolation.
- **Structured Concurrency:** No fiber should ever be orphaned. All background tasks must be tied to a `Scope` (e.g., via `Effect.forkScoped` or `Effect.forkDaemon` within a Layer).
- **Explicit Dependencies (DI):** Dependencies, configurations, and state must be passed through `Context.Tag` and resolved via `Layer`s, never through closures, singletons, or global variables.
- **Errors are Data:** Expected failures are part of the type signature (`Effect<Success, Error, Requirements>`). Only truly unrecoverable issues should result in Defects/Die.
- **Time is Monotonic (Clock, not Date):** All time-based operations must use `Effect.Clock` and `Schedule`, never `Date.now()`, `new Date()`, or `setTimeout`. Using wall-clock time breaks referential transparency, testability, and determinism — core tenets of Programs as Values.

# Preferred patterns
- **Entry Points:** Use `NodeRuntime.runMain` or `BunRuntime.runMain` at the top level to handle graceful shutdown and UNIX signals automatically.
- **Framework Bridging:** Instantiate `const runtime = ManagedRuntime.make(AppLayer)` once globally, then use `runtime.runPromise(effect)` inside framework route handlers.
- **State Management:** Use `Ref` or `Ref.Synchronized` wrapped in a `Context.Tag` to manage mutable state across fibers safely.
- **Resource Lifecycles:** Use `Effect.acquireRelease` to model setup/teardown (e.g., DB connections, WebSockets, Servers) and wrap them in `Layer.scoped`.
- **Throttling/Coordination:** Use Effect-native primitives (`Semaphore`, `Queue`, `Deferred`) injected via Context instead of relying on external state or raw Promises.

# Anti-patterns (Mental Model Violations)
- **Mid-flight Execution:** Calling `Effect.runPromise` or `Effect.runSync` inside domain logic, services, or mapping functions (breaks supervision and DI).
- **Per-Request Layer Provisioning:** Calling `Effect.provide(effect, AppLayer)` inside a hot path route handler (causes massive memory leaks and performance drops due to re-initializing the entire app per request).
- **Closure State Leaks:** Using `let` or `const` variables outside an Effect block to share state between fibers, bypassing Effect's concurrency safety.
- **Orphaned Background Loops:** Using `setInterval` or recursive `setTimeout` inside an Effect wrapper instead of using `Effect.schedule` + `Effect.forkDaemon`.
- **Wall-Clock Time Usage:** Using `Date.now()` or `new Date()` for time measurements or time-based decisions instead of `Effect.clock` with `Clock.currentTimeMillis` or `Clock.currentTimeNanos` — breaks referential transparency, testability, and determinism (Programs as Values violation).
- **Swallowing the Error Channel:** Using `.catch()` on Promises at the boundary without converting them into standard protocol responses (e.g., mapping Effect errors to JSON-RPC errors before returning from `ManagedRuntime`).

# Workflow
1. **Analyze Boundaries:** Locate where the code transitions from Effect-TS to standard Node.js/Promise (the "Edge of the World"). Validate if `ManagedRuntime` or `NodeRuntime` is used correctly.
2. **Trace Resource Ownership:** Identify resources (DBs, Servers, Timers). Ensure they are wrapped in `acquireRelease` and that their Scope is tied to the application lifecycle.
3. **Verify State Purity:** Scan for mutable variables (`let`, `Map`, `Set`) declared outside of `Ref` and accessed across multiple Effect operations. Recommend Context-based `Ref`.
4. **Audit Concurrency:** Check if parallel executions (`Effect.all`, `Effect.forEach`) are appropriately bounded (e.g., `concurrency: "unbounded"` vs `concurrency: 3` vs `Semaphore`).
5. **Document & Refactor:** For any mental model violation, explain *why* it breaks Effect-TS guarantees (e.g., "bypasses fiber supervision") and provide the correct structural pattern.

# Output contract
Return findings with:
- Conceptual mismatch identified (e.g., "Mid-flight Execution", "Closure State Leak").
- Explanation of how it violates Effect-TS principles (Impact on supervision, DI, or performance).
- Code example of the correct Principle-aligned pattern.
- Verification instructions to ensure the fix maintains correct framework integration.

# Severity Criteria
- **HIGH:** Calling `Effect.runPromise` inside a request handler with `.provide()` (causes severe memory leaks); Orphaned background fibers without Scope; Unhandled Promise rejections at the boundary; Using `Date.now()`, `new Date()`, or `setTimeout` instead of `Effect.Clock` or `Effect.sleep` — breaks testability and determinism (core tenets of Programs as Values).
- **MEDIUM:** Using closure state instead of `Ref` (causes race conditions).
- **LOW:** Suboptimal use of Layers where simple Context provision is enough; over-complicating purely synchronous data transformations.

# Acceptable Patterns (do NOT flag)
- `runtime.runPromise()` inside a 3rd-party event listener or API route handler (this is the correct bridge pattern).
- `Layer.succeed` for injecting static configuration objects or pure instances.
- Using `Effect.runSync` in pure unit tests where side effects and async bounds are not present.
- Stateful objects (classes) if they are strictly internal to a single fiber and not shared concurrently.

# Related Guides (from effect-ts skill references/)
- `./references/guide-effect.md` — Core `Effect` usage, constructors, composition, provisioning, runtime boundaries
- `./references/guide-layers.md` — Services, layer construction, composition, provisioning patterns
- `./references/guide-observability.md` — `Effect.fn`, spans, logging, metrics, telemetry wiring

# Delegation
- Delegate to `effect-ts` for research strategy, installation guidelines, and in-depth guidance across all Effect domains.
- Delegate to `effect-ts-anti-patterns` for low-level syntax corrections (e.g., generic Error usage).
- Delegate to `effect-ts-resource-layer` for implementing `acquireRelease` specifics.
- Delegate to `effect-ts-concurrency` for deep queueing and semaphore logic.

# Guardrails
- Focus on the *architecture* and *boundaries*. Do not nitpick purely stylistic choices if the mental model is sound.
- When suggesting `ManagedRuntime`, ensure you explain *where* it should be instantiated (globally, not per request).
- Always ensure that suggested changes respect the exact return types required by external frameworks (e.g., if MCP requires a Promise, ensure `runtime.runPromise` correctly returns that Promise).
