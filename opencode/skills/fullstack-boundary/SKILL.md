---
name: fullstack-boundary
description: Manage the integration boundary between Effect-TS backend services and React 19+ / Vite 8+ frontend, ensuring type-safe API contracts, error propagation, data serialization, and Server Action wiring.
---

# Companion Skill
Load `effect-ts` alongside this skill for research strategy, installation guidelines, and access to detailed reference guides covering Effect services, layers, error handling, and schema design. The main `effect-ts` skill provides the canonical research methodology: local guides first → codebase patterns → Effect source code.

# Purpose
This skill ensures the boundary between Effect-TS backend and React 19+ frontend is correctly managed — typed errors propagate cleanly, data serializes correctly, Server Actions wire to Effect services, and the API contract is consistent across domains.

# Use when
Reviewing code that spans the Effect-TS ↔ React boundary:
- Server Actions that call Effect-TS services or Layers
- Effect-TS error types that need to surface in React Error Boundaries or useActionState
- Effect Schema types that define the API contract between backend and frontend
- Data flowing from Effect-TS services to React components (Server Components, Actions)
- Environment configuration shared across backend and frontend
- Vite 8 SSR build configuration that runs Effect-TS code on the server

# Inputs
- Server Action files that invoke Effect-TS services
- Effect-TS error type definitions that cross to the frontend
- Effect Schema definitions used for API validation
- React component props derived from Effect-TS service output
- Vite SSR configuration and Environment API setup
- Shared type definitions and API contracts

# Core principles
- The boundary between Effect-TS and React is a **serialization boundary** — only JSON-serializable data crosses it
- Effect-TS runtime types (Effect, Ref, ScopedCache, etc.) must never reach the client bundle
- Effect-TS domain errors must map to typed Action error returns that React can pattern-match
- Server Actions are the bridge: they run Effect programs and return plain serializable results
- Effect Schema provides the type contract: it validates input on the server and generates TypeScript types for the frontend
- Environment variables and configuration must be managed differently on server vs client (never leak server secrets)

# Preferred patterns
- Use Effect Schema to define API request/response types and generate TypeScript types for React props
- Run Effect programs in Server Actions, return serializable results using `Effect.gen` + `Effect.catchTags`
- Map Effect-TS domain errors to serializable error unions for React Action error handling
- Use `Effect.runPromise` or `Effect.runPromiseExit` in Server Actions to execute Effect programs
- Return `{ success: T } | { error: DomainError }` from Server Actions for useActionState consumption
- Use Effect Layer to provide service dependencies to Server Action handlers
- Keep all Effect imports and runtime code in Server Components or Server Actions only
- Use Vite 8 Environment API for SSR builds that include Effect-TS server code
- Share only TypeScript type definitions (not Effect runtime) across the boundary

# Anti-patterns
- **Effect types on client**: Importing `Effect`, `Layer`, `Ref`, or any Effect runtime types in Client Components — these must stay server-side
- **Unmapped Effect errors**: Returning raw Effect errors (Cause, NoSuchElementException, etc.) to the client — always map to typed serializable error unions
- **Non-serializable data across boundary**: Returning Effect instances, Services, or Refs from Server Actions — only plain JSON-serializable data
- **Direct Effect execution in client**: Using `Effect.runPromise` or `Effect.runSync` in Client Components — all Effect execution happens on the server
- **Missing error mapping layer**: Server Actions that throw Effect errors instead of returning typed error unions
- **Inconsistent type contracts**: Frontend TypeScript types not derived from Effect Schema, leading to drift between backend and frontend types
- **Server secrets in client bundle**: Environment variables or Effect Configuration that contain secrets accessed in Client Components
- **Effect Layer not provided to Actions**: Server Actions calling Effect services without providing the required Layer, causing runtime dependency errors
- **Duplicate validation**: Re-validating on the client what Effect Schema already validates on the server (unnecessary duplication unless needed for optimistic UX)

# Workflow
1. Identify all Server Actions that call Effect-TS services and verify they provide required Layers
2. Check that all data returned from Server Actions is JSON-serializable (no Effect types, no class instances)
3. Verify Effect error types are mapped to serializable error unions for React consumption
4. Ensure no Effect runtime imports appear in Client Component bundles
5. Validate that shared types are derived from Effect Schema (single source of truth)
6. Check that server-only secrets and configuration don't leak to client bundle
7. Verify Vite SSR configuration correctly handles Effect-TS server code
8. Document each finding with location, boundary violation type, and recommended pattern

# Output contract
Return findings with:
- File location and line numbers
- Specific boundary issue (from anti-patterns list above)
- Explanation of boundary violation (bundle leak, type drift, serialization failure, error propagation break)
- Recommended integration pattern with code example
- Risk level (low/medium/high)
- Whether it affects frontend, backend, or both

# Severity Criteria
When assigning risk levels, use these definitions:
- **HIGH**: Effect runtime types leaking to client bundle (bundle bloat + potential crashes), server secrets in client bundle (security vulnerability), Effect errors not mapped to serializable types (runtime crash on client), Layer not provided to Server Actions (runtime error)
- **MEDIUM**: Type contract drift between Effect Schema and frontend types (incorrect API calls), duplicate validation on client (unnecessary bundle size), missing error mapping for some error cases (partial error handling), inconsistent serialization patterns (works but not idiomatic)
- **LOW**: Suboptimal but correct boundary patterns, Effect Schema not used but types manually kept in sync (correct but fragile), configuration patterns that work but could be cleaner

# Acceptable Patterns (do NOT flag)
These patterns are correct usage — do not flag them as anti-patterns:
- Server Actions calling `Effect.runPromise` or `Effect.runPromiseExit` with Layer provided — this IS the correct bridge
- `Effect.catchTags` mapping domain errors to serializable error objects — this IS correct error propagation
- Effect Schema generating TypeScript types for React prop interfaces — this IS correct type contract
- Server Actions returning `{ success: T } | { error: E }` unions for `useActionState` consumption — this IS the preferred pattern
- TypeScript type-only imports shared between server and client — this IS correct (no runtime code)
- Server-only Effect code in files that never ship to the client — this IS correct
- Vite 8 SSR externalizing Effect packages that shouldn't bundle — this IS correct configuration
- `useActionState` consuming typed error returns from Effect-backed Server Actions — this IS the complete pipeline

# Related Guides (from effect-ts skill references/)
- `../effect-ts/references/guide-error-handling.md` — Typed domain errors for API contracts
- `../effect-ts/references/guide-layers.md` — Layer provisioning for Server Actions
- `../effect-ts/references/guide-schema.md` — Effect Schema for type-safe API contracts

# Delegation
Delegate to:
- **effect-ts** for research strategy, installation guidelines, and in-depth guidance on Effect patterns
- react-vite-error-handling for Error Boundary and Suspense issues on the React side
- effect-ts-error-handling for Effect error type design on the backend side
- effect-ts-resource-layer for Layer provisioning issues in Server Actions
- effect-ts-anti-patterns for Effect anti-patterns that may affect the boundary

# Guardrails
- Never suggest importing Effect runtime in Client Components
- Never suggest removing Effect error handling without equivalent serializable error mapping
- Do not suggest duplicating validation on the client that Effect Schema handles on the server unless needed for optimistic UX
- Preserve Layer dependency structure when modifying Server Action integration
- Do not suggest changing the frontend error types without ensuring the backend maps to them correctly
- Respect the serialization boundary — only JSON-serializable data crosses from server to client