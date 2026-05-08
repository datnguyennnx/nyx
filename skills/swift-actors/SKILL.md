---
name: swift-actors
description: Design correct actor isolation domains, @MainActor surfaces, Sendable conformances, and structured concurrency patterns in Swift 6.3.
---

# Purpose
This skill ensures Swift 6.3 code uses actor isolation, async/await, and structured concurrency correctly — with proper Sendable conformance, safe @MainActor usage, and no data races under strict concurrency checking.

# Use when
Reviewing Swift 6.3 code to:
- Define actor isolation boundaries (which types should be actors vs @MainActor vs nonisolated)
- Ensure Sendable conformance is genuine, not suppressed with @unchecked
- Replace DispatchQueue / completion handler patterns with structured async/await
- Bound unstructured Task usage (Task.detached, Task { } fire-and-forget)
- Handle actor reentrancy correctly at await suspension points
- Choose correct concurrency primitives (AsyncStream, AsyncChannel, actor, TaskGroup)

# Inputs
- actor and @globalActor type definitions
- @MainActor annotations on types, methods, properties
- Sendable conformances (including @unchecked)
- async/await call sites and suspension points
- Task { }, Task.detached { }, TaskGroup usage
- DispatchQueue, OperationQueue, completion handler patterns
- AsyncStream, AsyncThrowingStream, continuation usage

# Core principles
- Actor isolation is a compile-time guarantee; don't suppress it with @unchecked Sendable
- @MainActor should be applied at the smallest necessary surface, not as a blanket fix
- Suspension points (await) are potential reentrancy points — state must be valid before and after
- Structured concurrency (async let, TaskGroup) is preferred over unstructured Task
- Sendable conformance must reflect actual thread-safety — value types, actors, or explicit synchronization
- nonisolated(unsafe) is never acceptable in production code
- Task lifetimes must be tied to their owner's lifetime (store in a Set<AnyCancellable> equivalent or use structured scope)

# Preferred patterns
- Use actor for types that manage shared mutable state accessed from multiple concurrency domains
- Apply @MainActor to entire View types and ViewModels that must update UI
- Use async let for bounded parallel work with known count
- Use TaskGroup for dynamic parallelism with structured lifetime
- Use AsyncStream for bridging delegate/callback APIs into async sequences
- Conform value types (struct, enum) to Sendable when they contain only Sendable stored properties
- Use withCheckedContinuation / withCheckedThrowingContinuation for safe callback bridging
- Store long-lived Tasks in a Task property and cancel in deinit or .onDisappear

# Anti-patterns
- @unchecked Sendable: marking a class Sendable without actual thread-safety guarantees
- nonisolated(unsafe): bypassing isolation for convenience without synchronization
- DispatchQueue.main.async as a fix for MainActor violations instead of proper isolation
- Task.detached without explicit actor context leading to unintended isolation
- Fire-and-forget Task { } without storing or cancelling — leads to Task leak and unhandled errors
- Blanket @MainActor on everything to silence warnings instead of designing isolation properly
- Accessing actor state without await by casting to the concrete type
- Assuming state is unchanged after an await suspension point (reentrancy bug)
- Blocking async context with sync-over-async (semaphore.wait() in async function)
- Using continuation resume in multiple paths (double-resume crash)

# Workflow
1. Identify all actor, @globalActor, and @MainActor usages and verify each is justified
2. Scan for @unchecked Sendable and nonisolated(unsafe) — flag each as requiring architect review
3. Check for DispatchQueue / completion handler patterns and propose async/await replacements
4. Review Task { } and Task.detached { } sites — are they stored, cancelled, and error-handled?
5. Examine await suspension points in actors — is state valid post-suspension (reentrancy safe)?
6. Verify AsyncStream / continuation usage for correct single-resume guarantee
7. Check TaskGroup and async let for proper structured lifetime and error propagation
8. Document each finding with location, problem explanation, and Swift 6.3-native fix

# Output contract
Return findings with:
- File location and line numbers
- Specific concurrency issue (from anti-patterns list above)
- Explanation of why it causes a data race, crash, or isolation violation
- Recommended Swift 6.3-native alternative with code example
- Risk level (low/medium/high)
- Whether it would be caught by Swift 6 strict concurrency compiler flag

# Severity Criteria
When assigning risk levels, use these definitions:
- **HIGH**: Data race, crash potential, double-resume continuation, memory leak from uncancelled Task — will cause production failures
- **MEDIUM**: @unchecked Sendable that may actually be safe but isn't verified, reentrancy risk at await points, missing Task cancellation — unreliable under edge cases
- **LOW**: Non-idiomatic concurrency pattern that works, suboptimal primitive choice — functionally correct but not best practice

# Acceptable Patterns (do NOT flag)
These patterns are correct usage — do not flag them as anti-patterns:
- `actor` for types managing shared mutable state from multiple domains — this IS proper isolation
- `@MainActor` on entire View types and ViewModels that update UI — this IS correct UI isolation
- `async let` for bounded parallel work with known count — this IS structured concurrency
- `TaskGroup` for dynamic parallelism with structured lifetime — this IS correct structured concurrency
- `AsyncStream` for bridging delegate/callback APIs — this IS proper callback bridging
- `withCheckedContinuation` / `withCheckedThrowingContinuation` for safe callback bridging — this IS correct continuation usage
- `Sendable` conformance on struct/enum with only Sendable stored properties — this IS genuine conformance
- Storing long-lived Tasks in a property and cancelling in `deinit` or `.onDisappear` — this IS proper Task lifecycle management
- `nonisolated` computed properties that only access Sendable data — this IS correct isolation opt-out

# Delegation
Delegate to:
- swift-anti-patterns for DispatchQueue / callback detection and general code smell
- swift-error-handling for error propagation in async contexts and TaskGroup error handling
- swift-swiftui-patterns for @MainActor usage in View and ViewModel context

# Guardrails
- Never suggest removing actor isolation without equivalent safe replacement
- Do not suggest @MainActor as a blanket solution — understand the isolation need first
- Avoid suggesting actors where a simple value type with Sendable conformance suffices
- Never accept @unchecked Sendable or nonisolated(unsafe) as solutions
- Do not suggest eliminating structured concurrency in favor of manual thread management
- Preserve original concurrency semantics when adding safety (don't silently sequentialize parallel work)
