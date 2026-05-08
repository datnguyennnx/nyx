---
name: effect-ts-anti-patterns
description: Detect Promise-first code, hidden dependencies, generic Error misuse, and unsafe resource patterns in Effect-TS code.
---

# Purpose
This skill identifies common Effect-TS anti-patterns that compromise type safety, resource safety, and maintainability.

# Use when
Reviewing Effect-TS source files to detect:
- Promise usage outside Effect.tryPromise/Effect.async
- Service interfaces leaking implementation dependencies
- Generic Error catches/throws instead of typed errors
- Unbounded concurrency primitives (forkAll, parallel collections)
- Manual resource management without Scope or Layer
- Overly complex Effect.gen blocks mixing multiple responsibilities

# Inputs
- Effect-TS source files (.ts, .tsx)
- Service interface definitions
- Layer configuration files
- Effect.gen usage patterns
- Concurrency primitive usage (fork, forkAll, etc.)
- Error handling blocks (catch, try/catch)

# Core principles
- Prefer Effect-native solutions over Promise interop
- Keep dependency boundaries explicit through Layer construction
- Use typed errors instead of generic Error
- Bound concurrency with appropriate primitives
- Make resource cleanup ownership explicit
- Separate concerns in Effect generators

# Preferred patterns
- Use Effect.tryPromise or Effect.async for Promise interop
- Define service interfaces without implementation dependencies in requirements
- Create typed error classes extending Effect.TaggedError
- Use Semaphore, Queue, or Schedule for bounded concurrency
- Use Scope and Layer.effect for resource lifecycle management
- Keep Effect.gen blocks focused on single responsibilities

# Anti-patterns
- Promise-first code: await fetch() inside Effect.gen without proper lifting
- Hidden dependencies: service interfaces requiring concrete implementations in requirements
- Generic Error misuse: catching or throwing unknown Error instead of typed errors
- Unbounded concurrency: Effect.forkAll without limits or Semaphore bounds
- Unsafe resources: manual resource acquisition/release without Scope or Layer.effect
- Oversized generators: Effect.gen mixing data fetching, transformation, and persistence logic

# Workflow
1. Scan for Promise usage outside Effect.tryPromise/Effect.async and flag for replacement
2. Check service interfaces for implementation-specific types in requirements and suggest moving to Layer
3. Identify generic Error catches/throws and recommend typed error alternatives
4. Look for unbounded forkAll or parallel collections without concurrency bounds
5. Find manual resource management (open/close) without Scope or Layer.effect
6. Review Effect.gen blocks for >3 distinct responsibilities and suggest splitting
7. Document each finding with location, problem explanation, and fix recommendation

# Output contract
Return findings with:
- File location and line numbers
- Specific anti-pattern detected (from list above)
- Explanation of why it's problematic (type safety, resource leak, etc.)
- Recommended Effect-native alternative
- Risk level (low/medium/high)
- Verification notes for any Effect-TS claims made

# Severity Criteria
When assigning risk levels, use these definitions:
- **HIGH**: Direct risk of resource leak, data loss, crash, unhandled error propagation, or type safety violation that will cause runtime failures
- **MEDIUM**: Type safety violation, incorrect error handling pattern, unbounded behavior that could degrade under load — not immediately crashing but wrong by Effect-TS conventions
- **LOW**: Non-idiomatic pattern, suboptimal but functionally correct, missing optimization — code works but doesn't follow Effect-TS best practices

# Acceptable Patterns (do NOT flag)
These patterns are correct usage — do not flag them as anti-patterns:
- `Effect.tryPromise` or `Effect.async` wrapping Promise code — this IS proper Promise interop
- `Effect.catchAll` at main/worker entry points for defect logging — this IS appropriate boundary catch
- `Layer.succeed` for simple config values or pure dependencies — this IS correct usage
- `Effect.catchTag` / `Effect.catchTags` for specific typed error handling — this IS the preferred pattern
- `Effect.gen` blocks with 1-3 focused responsibilities — this IS acceptable complexity
- `Effect.orElse` / `Effect.orElseSucceed` for fallback strategies — this IS proper recovery
- `Effect.timeout` with explicit duration on operations — this IS proper bounding
- `Scope` for localized resource lifetime when Layer sharing isn't appropriate — this IS correct

# Delegation
Delegate to:
- effect-ts-error-handling for typed error refactoring guidance
- effect-ts-resource-layer for resource management issue resolution
- effect-ts-concurrency for concurrency bounding strategies

# Guardrails
- Only suggest changes that preserve behavioral semantics
- Never remove error handling without equivalent typed replacement
- Avoid suggesting Layer usage where simpler effect suffices
- Prevent over-engineering simple synchronous operations
- Do not suggest architecture changes without proven boundary problems