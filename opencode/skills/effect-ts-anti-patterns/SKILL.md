---
name: effect-ts-anti-patterns
description: Detect Promise-first code, hidden service dependencies, and oversized Effect.gen blocks in Effect-TS code.
---

# Purpose
This skill identifies common syntax-level and structural anti-patterns in Effect-TS code that compromise clarity, maintainability, and proper interop boundaries. It does NOT cover concurrency, error handling, or resource management — those are delegated to their dedicated skills.

# Use when
Reviewing Effect-TS source files to detect:
- Promise usage outside `Effect.tryPromise`/`Effect.async`
- Service interfaces leaking implementation dependencies in their requirements
- Overly complex `Effect.gen` blocks mixing multiple concerns
- Hidden dependency construction (module-level singletons, closure state)

# Inputs
- Effect-TS source files (.ts, .tsx)
- Service interface definitions
- Effect.gen usage patterns
- Promise interop code (async/await inside generators)

# Core principles
- Prefer Effect-native constructors over raw Promise interop
- Keep service interface requirements free of implementation details
- Keep `Effect.gen` blocks focused on a single responsibility

# Preferred patterns
- Use `Effect.tryPromise` or `Effect.async` for wrapping Promise-based APIs
- Define service interfaces with only service tag requirements
- Keep `Effect.gen` blocks to 1-3 focused responsibilities
- Use `Layer` (via `effect-ts-resource-layer`) for dependency wiring, not module-scope singletons

# Anti-patterns
- **Promise-first code:** `await fetch()` inside `Effect.gen` without proper lifting through `Effect.tryPromise`
- **Hidden dependencies:** service interfaces requiring concrete implementation types in their `Requirements` type
- **Oversized generators:** `Effect.gen` blocks mixing data fetching, transformation, and persistence logic
- **Module-level singletons:** constructing resources (clients, pools) at module scope instead of inside `Layer`

# Workflow
1. Scan for raw `await` calls inside `Effect.gen` and flag for `Effect.tryPromise` wrapping
2. Check service interfaces for implementation-specific types leaking into their `Requirements`
3. Review `Effect.gen` blocks for >3 distinct responsibilities and suggest splitting
4. Detect module-level `const db = new Pool()` or similar singleton patterns outside `Layer`
5. Document each finding with location, problem explanation, and fix recommendation

# Output contract
Return findings with:
- File location and line numbers
- Specific anti-pattern detected (from list above)
- Explanation of why it's problematic
- Recommended idiomatic alternative
- Risk level (low/medium/high)
- Verification notes for any Effect-TS claims made

# Severity Criteria
When assigning risk levels, use these definitions:
- **HIGH**: Direct risk of runtime failure, type unsafety, or severe maintainability degradation
- **MEDIUM**: Pattern violation that degrades clarity or testability but does not cause immediate failures
- **LOW**: Non-idiomatic pattern — functionally correct but not following best practices

# Acceptable Patterns (do NOT flag)
These patterns are correct usage — do not flag them as anti-patterns:
- `Effect.tryPromise` or `Effect.async` wrapping Promise code — this IS proper Promise interop
- `Effect.gen` blocks with 1-3 focused responsibilities — this IS acceptable complexity
- `Layer.succeed` for simple config values or pure dependencies — this IS correct
- Service interfaces requiring only service tags in their Context — this IS clean boundary
- `Effect.catchTag` / `Effect.catchTags` for specific typed error handling — this IS the preferred pattern (domain of `effect-ts-error-handling`)
- `Scope` for localized resource lifetime when Layer sharing isn't appropriate — this IS correct (domain of `effect-ts-resource-layer`)

# Delegation
This skill is a syntax-level and structural lens only. For deeper analysis, delegate to:
- **effect-ts-principle-thinking** for mental model violations (mid-flight execution, per-request provisioning, closure state leaks, DI violations)
- **effect-ts-error-handling** for anything involving typed errors, catch blocks, retry, or error recovery
- **effect-ts-resource-layer** for anything involving `Scope`, `Layer`, `acquireRelease`, or resource lifecycle
- **effect-ts-concurrency** for anything involving `fork`, `Semaphore`, `Queue`, parallel collections, or fiber management

# Guardrails
- Only suggest changes that preserve behavioral semantics
- NEVER diagnose concurrency, error handling, or resource lifecycle issues — delegate those
- Avoid suggesting `Layer` usage where simpler patterns suffice (delegate to `effect-ts-resource-layer`)
- Prevent over-engineering simple synchronous operations
- Do not suggest architecture changes without proven problems
- If a finding spans multiple domains, flag it and delegate to the appropriate skill
