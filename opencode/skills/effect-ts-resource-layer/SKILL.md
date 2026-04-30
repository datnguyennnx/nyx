---
name: effect-ts-resource-layer
description: Manage resource lifecycle and dependency graphs using Layer construction patterns with explicit acquisition and release semantics.
---

# Purpose
This skill ensures proper resource lifecycle management and dependency graph construction using Effect.Layer patterns, preventing leaks and unclear ownership by making acquisition/release explicit and scoped appropriately.

# Use when
Reviewing Effect-TS code to:
- Acquire and release resources (database connections, file handles, HTTP clients, etc.)
- Construct service dependencies through Layer composition rather than service requirements
- Manage singleton vs per-usage resource lifetimes using Layer memoization
- Handle resource initialization and finalization logic with proper error handling
- Avoid hidden global or singleton construction anti-patterns outside Layer context
- Replace manual resource management with Scope or Layer.effect patterns

# Inputs
- Layer definitions and compositions (Layer.succeed, Layer.effect, Layer.merge)
- Resource acquisition/allocation code (open/connect/create patterns)
- Service provider implementations and interfaces
- Finalization/cleanup logic (close/dispose/release patterns)
- Effect.scoped and Effect.acquireRelease usage
- Dependency injection points and service usage
- Effect.gen blocks that manage resources

# Core principles
- Layer is a constructor/composition abstraction for dependency graphs, not a place for business logic
- Resource lifetime and cleanup ownership must be explicit in the type system
- Use Layer.effect for effectful resource construction that may fail during acquisition
- Use Layer.succeed for pure values or already-created resources that need no cleanup
- Prefer scoped resource construction (Layer.effect with Scope) for localized lifetimes
- Avoid constructing resources outside Layer context (module scope, service methods) to prevent hidden globals
- Ensure finalizers run even when errors occur during acquisition using Effect.acquireRelease
- Keep service interfaces independent of resource details by managing dependencies at Layer level

# Preferred patterns
- Define resources as Layer.effect with Effect.acquireRelease for safe acquisition/release
- Compose layers using Layer.merge (parallel) and Layer.provide (sequential dependency)
- Use Scope for localized resource lifetime when Layer sharing isn't appropriate
- Make cleanup logic idempotent and error-tolerant to handle double-release safely
- Use Layer.memoize for expensive, shareable resource construction that should be cached
- Keep service interfaces independent of resource details by requiring only the service tag
- Handle partial failures in resource acquisition gracefully with Effect.either or Effect.optional

# Anti-patterns
- Manual resource management without Scope or Layer (direct open/close in service methods)
- Constructing singletons in module scope (hidden globals violating dependency principles)
- Leaking implementation dependencies through service interface requirements
- Forgetting to release resources on acquisition failure (missing release in acquireRelease)
- Using Layer where simpler provision (effect) suffices for values that need no lifecycle management
- Creating resources in Effect.gen without proper scoping (leading to leaks or long lifetimes)
- Non-idempotent finalizers that fail on double-release (unsafe cleanup logic)
- Mixing business logic with resource construction in Layer (violates separation of concerns)
- Creating Layers that mix unrelated concerns (configuration, logging, database in one layer)

# Workflow
1. Identify all resource acquisition points (database connections, file handles, clients, etc.)
2. Check if resources are managed through Layer.effect/Effect.acquireRelease or Scope
3. Verify acquisition and release logic is paired correctly in Effect.acquireRelease tuples
4. Look for hidden global/resource construction outside Layer (module scope, class fields, service methods)
5. Examine service interfaces for implementation leakage in requirements (Config | Logger etc.)
6. Review Layer composition for proper dependency ordering and separation of concerns
7. Validate that finalizers handle errors during acquisition (release should not fail if acquire failed)
8. Check for proper scoping (Layer vs Scope) based on resource lifetime requirements
9. Ensure Layer.memoize is used appropriately for expensive shareable resources
10. Document each finding with location, problem explanation, and Layer/Scope-based fix recommendation

# Output contract
Return findings with:
- File location and line numbers
- Specific resource management issue (from anti-patterns list above)
- Explanation of why it risks leaks or unclear ownership (type safety, lifecycle violation)
- Recommended Layer or Scope-based pattern with code example
- Risk level (low/medium/high)
- Verification notes for any Effect-TS claims made regarding resource management

# Delegation
Delegate to:
- effect-ts-anti-patterns for unsafe resource lifecycle detection and Promise-first resource usage
- effect-ts-error-handling for error handling in resource acquisition and release logic
- effect-ts-concurrency for resource usage in concurrent operations (pooling, semaphores)

# Guardrails
- Never suggest removing resource cleanup logic without equivalent safe replacement
- Preserve original resource acquisition semantics when improving safety
- Avoid over-scoping resources that should be shared (don't memoize unnecessarily)
- Don't suggest Layer for simple values that don't need lifecycle management (use effect/succeed)
- Prevent creating Layers that mix unrelated concerns (split by responsibility: config, logger, db)
- Do not suggest eliminating resource management; instead recommend proper Layer/Scope patterns