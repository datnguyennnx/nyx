---
name: effect-ts-anti-patterns
description: Detect Promise-first code, hidden service dependencies, and oversized Effect.gen blocks in Effect-TS code.
---

# Purpose
This skill identifies syntax-level and code-smell anti-patterns in Effect-TS code. It does NOT cover concurrency, error handling, resource lifecycle, or mental model violations — those are delegated to their dedicated skills. This skill is a pure detection lens: it flags patterns, never prescribes fixes beyond suggesting delegation to the appropriate skill.

# Use when
Reviewing Effect-TS source files to detect:
- Raw Promise usage outside `Effect.tryPromise`/`Effect.async`
- Service interfaces leaking implementation dependencies in their requirements
- Overly complex `Effect.gen` blocks mixing multiple concerns
- Module-level singleton resource construction

DO NOT use for:
- Concurrency correctness (fork, Semaphore, Queue) — delegate to `effect-ts-concurrency`
- Typed error handling or error recovery — delegate to `effect-ts-error-handling`
- Resource lifecycle or Layer construction — delegate to `effect-ts-resource-layer`
- Mental model violations (mid-flight execution, per-request provisioning) — delegate to `effect-ts-principle-thinking`

# Inputs
- Effect-TS source files (.ts, .tsx)
- Service interface definitions
- Effect.gen usage patterns
- Promise interop code (async/await inside generators)

# Core principles
- Prefer Effect-native constructors over raw Promise interop
- Keep service interface requirements free of implementation details
- Keep `Effect.gen` blocks focused on a single responsibility
- This skill detects syntax-level patterns only — deeper analysis is always delegated

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
5. For each finding: flag and delegate to the appropriate skill for fix guidance
6. Document each finding with location, pattern name, and delegation target

# Output contract
Return findings with:
- File location and line numbers
- Specific anti-pattern detected (from list above)
- Explanation of why it is a syntax/code-smell issue
- Delegation target skill for the fix
- Risk level (low/medium/high — syntax-severity only)

# Severity Criteria
When assigning risk levels, use these definitions:
- **HIGH**: Pattern causes direct type unsafety, runtime failure, or severe maintainability degradation
- **MEDIUM**: Pattern violation that degrades clarity or testability but does not cause immediate failures
- **LOW**: Non-idiomatic pattern — functionally correct but not following best practices

# Acceptable Patterns (do NOT flag)
These patterns are correct usage — do not flag them as anti-patterns:
- `Effect.tryPromise` or `Effect.async` wrapping Promise code — this IS proper Promise interop
- `Effect.gen` blocks with 1-3 focused responsibilities — this IS acceptable complexity
- `Layer.succeed` for simple config values or pure dependencies — this IS correct
- Service interfaces requiring only service tags in their Context — this IS clean boundary
- `Effect.catchTag` / `Effect.catchTags` for specific typed error handling — delegated to `effect-ts-error-handling`
- `Scope` for localized resource lifetime — delegated to `effect-ts-resource-layer`

# Delegation
This skill is a syntax-level and structural lens ONLY. For deeper analysis, delegate to:
- **effect-ts-principle-thinking** for mental model violations (mid-flight execution, per-request provisioning, closure state leaks, DI violations)
- **effect-ts-error-handling** for anything involving typed errors, catch blocks, retry, or error recovery
- **effect-ts-resource-layer** for anything involving `Scope`, `Layer`, `acquireRelease`, or resource lifecycle
- **effect-ts-concurrency** for anything involving `fork`, `Semaphore`, `Queue`, parallel collections, or fiber management

# Guardrails
- Only detect syntax-level and structural code-smell patterns
- NEVER diagnose concurrency correctness — delegate to `effect-ts-concurrency`
- NEVER diagnose error handling or typed errors — delegate to `effect-ts-error-handling`
- NEVER diagnose resource lifecycle or Layer patterns — delegate to `effect-ts-resource-layer`
- NEVER diagnose mental model violations — delegate to `effect-ts-principle-thinking`
- For every finding, specify which skill should handle the fix guidance
- If a finding spans multiple domains, flag each domain separately and delegate to each skill
- Do not suggest implementation changes — flag and delegate
