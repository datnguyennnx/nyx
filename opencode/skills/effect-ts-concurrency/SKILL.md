---
name: effect-ts-concurrency
description: Manage concurrent operations with proper fiber usage, interruption handling, and bounded parallelism using Effect primitives.
---

# Purpose
This skill ensures Effect-TS code uses concurrency primitives correctly with proper fiber management, interruption awareness, and bounded parallelism to prevent resource exhaustion and maintain correctness.

# Use when
Reviewing Effect-TS code to:
- Replace unsafe Promise-based concurrency with fiber-native approaches (Effect.fork, etc.)
- Apply appropriate bounds to concurrent operations (using concurrency options or Semaphore)
- Ensure interruption safety for concurrent operations (using Effect.ensure, Effect.addFinalizer)
- Choose correct coordination primitives (Queue, Deferred, Semaphore, Ref) based on actual needs
- Detect runaway fan-out and missing backpressure (unbounded concurrent operations)
- Distribute work appropriately across available resources (parallel vs sequential considerations)

# Inputs
- Effect.fork, Effect.forkAll, Effect.forkDaemon usage
- Concurrent collections (Effect.forEach, Effect.parallel, Effect.partition etc.)
- Queue, Deferred, Semaphore, Ref, PubSub usage and creation patterns
- Effect.race and Effect.firstSuccessOf usage patterns
- Fiber interruption handling (Effect.interrupt, Effect.onInterrupt)
- Resource usage in concurrent contexts (database connections, file handles, etc.)
- Effect.schedule usage for retry/timing in concurrent operations

# Core principles
- Concurrency must be intentional and bounded where appropriate to prevent resource exhaustion
- Fibers are lightweight but not free - avoid unbounded creation that can lead to memory issues
- Interruption must be handled properly for resource safety (finalizers must run on interruption)
- Choose coordination primitives based on actual coordination needs (don't over-coordinate)
- Prefer collection concurrency (Effect.forEach) with bounds over manual fork management
- Use Semaphore for resource limiting, Queue for producer/consumer patterns with backpressure
- Use Deferred for one-time synchronization between fibers, Ref for coordinated state updates
- Ensure proper error propagation in concurrent contexts (don't swallow errors from fibers)

# Preferred patterns
- Use Effect.forEach with { concurrency: n } instead of Effect.forkAll for bounded parallelism
- Apply Effect.retry or Effect.timeout to individual concurrent operations when appropriate
- Use Semaphore to limit concurrent resource acquisition (database connections, file handles, etc.)
- Use Queue for producer/consumer patterns where producers may outpace consumers
- Use Deferred for one-time event signaling between fibers (not for repeated coordination)
- Use Ref for shared state that needs atomic updates (Effect.update, Effect.modify)
- Use Effect.race with cancellation awareness (race winners should cancel losers when appropriate)
- Handle fiber interruption with Effect.addFinalizer or Effect.ensure for resource cleanup
- Use Effect.scoped with concurrent operations when resources need deterministic cleanup

# Anti-patterns
- Unbounded concurrency: Effect.forkAll on large collections without Semaphore or concurrency limits
- Ignoring interruption: not cleaning up resources when fibers are interrupted (missing finalizers)
- Misusing primitives: using Queue when simple Ref or effect suffices for state sharing
- Lost updates: concurrent Ref modification without atomic operations (use Effect.update/modify)
- Unbounded Queues: Queue.unbounded without backpressure considerations in producer/consumer
- Fire-and-forget: Effect.forkDaemon without supervision strategy or error handling
- Missing error handling: concurrent operations that swallow errors instead of propagating or logging
- Over-coordination: using Semaphore or Queue when simple parallelism with bounds suffices
- Race conditions: checking-then-acting on shared state without atomic operations
- Blocking operations in fibers: using synchronous blocking calls that prevent fiber yielding

# Workflow
1. Identify all fork/forkAll/forkDaemon usage and assess if bounding is needed
2. Check for bounded parallelism in concurrent collections (look for concurrency option)
3. Review Queue, Deferred, Semaphore, Ref usage for correctness (match primitive to problem)
4. Verify interruption handling in long-running fibers (look for Effect.ensure/addFinalizer)
5. Look for runaway fan-out patterns (unbounded concurrent operations without limits)
6. Ensure proper error propagation in concurrent contexts (errors should not be silently swallowed)
7. Validate coordination primitives match actual coordination needs (is coordination really needed?)
8. Check for blocking operations in fibers that would prevent yielding and cause starvation
9. Document each finding with location, problem explanation, and fix recommendation using Effect primitives

# Output contract
Return findings with:
- File location and line numbers
- Specific concurrency issue (from anti-patterns list above)
- Explanation of why it risks resource exhaustion or correctness problems (memory leaks, deadlocks, etc.)
- Recommended fiber-native or bounded alternative with code example
- Risk level (low/medium/high)
- Verification notes for any Effect-TS claims made regarding concurrency

# Delegation
Delegate to:
- effect-ts-anti-patterns for Promise-first concurrency detection and unsafe resource usage
- effect-ts-error-handling for error handling in concurrent operations (propagation vs swallowing)
- effect-ts-resource-layer for resource usage in concurrent operations (acquisition/release safety)

# Guardrails
- Never suggest removing interruption handling or finalizers for resource safety
- Preserve original concurrency semantics when bounding (don't change behavior, just add safety)
- Avoid suggesting coordination primitives where simple parallelism with bounds suffices
- Don't bound operations that genuinely need unlimited concurrency (monitoring, event processing)
- Prevent over-coordinating simple data transformation pipelines (map/filter operations)
- Do not suggest eliminating necessary concurrency; instead recommend proper bounding and safety