---
name: react-vite-error-handling
description: Implement proper error boundaries, error reporting, and recovery patterns in React 19+ / Vite 8+ applications with typed error strategies and graceful degradation.
---

# Purpose
This skill ensures React 19+ / Vite 8+ applications handle errors correctly at every level — component boundaries, async operations, form submissions, and build-time errors — using React 19's improved error handling APIs and proper Error Boundary placement.

# Use when
Reviewing React 19+ / Vite 8+ code to:
- Place Error Boundaries at correct granularity for async operations and component trees
- Implement React 19's `onCaughtError`, `onUncaughtError`, `onRecoverableError` root options
- Ensure form Actions have proper error handling with `useActionState`
- Validate that `useOptimistic` has correct rollback behavior on error
- Handle suspension and loading states with Suspense boundaries
- Configure Vite 8 error handling for SSR, build, and dev server
- Design typed error strategies for API responses and domain errors

# Inputs
- Error Boundary component implementations and placements
- React root creation options (`createRoot`, `hydrateRoot`) for error callbacks
- Action handlers and `useActionState` error handling
- `useOptimistic` rollback patterns
- Suspense boundary placements
- API error response types and error mapping
- Vite configuration for error handling (dev server, SSR, build)
- Server Action error return types

# Core principles
- Error Boundaries are structural requirements, not optional — every async boundary needs one
- React 19 distinguishes caught errors (in Error Boundary), uncaught errors, and recoverable errors — handle each differently
- Actions (`useActionState`, `<form action>`) automatically handle error states — don't reimplement manually
- `useOptimistic` automatically rolls back on error — don't double-implement rollback logic
- Server Actions should return typed error results, not throw — the client receives serialized error data
- Suspense boundaries must be placed at meaningful UI boundaries to enable progressive loading
- Build-time errors (Vite) and runtime errors (React) require different strategies

# Preferred patterns
- Use React 19 `createRoot(container, { onCaughtError, onUncaughtError, onRecoverableError })` for structured error reporting
- Wrap async operations and Server Components with `<ErrorBoundary>` and `<Suspense>` at meaningful UI boundaries
- Use `useActionState` with typed error return for form submissions — return error state instead of throwing
- Let `useOptimistic` handle automatic rollback on error — do not add manual rollback logic
- Create typed error classes for domain errors (ValidationError, AuthError, NetworkError) with actionable messages
- Use `use(promise)` inside `<Suspense>` for data loading — let the Suspense boundary handle the loading and error states
- Configure Vite 8 `server.hmr` and `server.middlewareMode` for dev error handling
- Use Error Boundary composition — nested boundaries for fine-grained recovery
- Return structured error types from Server Actions for client-side typed error handling

# Anti-patterns
- **Missing Error Boundary**: Async operations, form submissions, or Server Components without Error Boundary wrapping
- **Missing Suspense fallback**: `use(promise)` or async Server Components without `<Suspense>` boundary
- **Manual error state for Actions**: Using `useState` for error states in form submissions when `useActionState` provides error handling
- **Double rollback implementation**: Adding manual rollback logic alongside `useOptimistic` which already handles automatic rollback
- **Catch-all error boundaries**: Single top-level Error Boundary instead of granular boundaries at meaningful UI sections
- **Throwing from Server Actions**: Server Actions that throw errors instead of returning typed error results for client consumption
- **Swallowed errors**: `catch` blocks that silently ignore errors without logging or user notification
- **Generic error messages**: Showing raw error messages to users instead of user-friendly typed error messages
- **Missing error type mapping**: API responses returned directly without mapping to domain error types
- **useEffect error handling override**: Using useEffect to handle errors that React 19's Action system already handles
- **No error reporting**: Production errors not reported to monitoring (onCaughtError, onUncaughtError not configured)
- **Unstructured error responses**: Server Actions returning `string` or `unknown` instead of typed error unions

# Workflow
1. Identify all Error Boundary placements and verify coverage for async operations
2. Check React root creation for `onCaughtError`, `onUncaughtError`, `onRecoverableError` configuration
3. Verify `useActionState` usage includes proper error return types and handling
4. Check `useOptimistic` usage for correct automatic rollback (no manual double-rollback)
5. Verify Suspense boundaries exist around all `use(promise)` calls and async Server Components
6. Review Server Action error return types — should be typed unions, not throws
7. Check for swallowed errors in catch blocks
8. Validate error reporting configuration for production monitoring
9. Review API error mapping — domain errors should be typed, not generic
10. Document each finding with location, error handling gap, and recommended pattern

# Output contract
Return findings with:
- File location and line numbers
- Specific error handling issue (from anti-patterns list above)
- Explanation of error risk (unhandled errors, poor UX, missing monitoring, recovery failure)
- Recommended React 19 error handling pattern with code example
- Risk level (low/medium/high)
- Whether it affects user experience, error reporting, or both

# Severity Criteria
When assigning risk levels, use these definitions:
- **HIGH**: Missing Error Boundary on mutation handlers (errors crash entire page), Server Actions that throw instead of returning typed errors (client cannot handle gracefully), no error reporting in production — will cause blank screens or unhandled errors
- **MEDIUM**: Single monolithic Error Boundary (coarse recovery), manual error state when Actions handle it (redundant code), missing Suspense fallback (loading flash), generic error messages — degrades error recovery UX
- **LOW**: Suboptimal Error Boundary granularity that still works, verbose error types that could be simplified, missing error type mapping that still surfaces meaningful messages — works but doesn't follow best practices

# Acceptable Patterns (do NOT flag)
These patterns are correct usage — do not flag them as anti-patterns:
- `createRoot(domNode, { onCaughtError, onUncaughtError, onRecoverableError })` — this IS React 19 error reporting
- `useActionState` returning typed error results — this IS the preferred Action error pattern
- `useOptimistic` with automatic rollback on error — this IS correct, no manual rollback needed
- Nested `<ErrorBoundary>` at meaningful UI sections — this IS recommended granular recovery
- `<Suspense fallback={...}>` around async content — this IS required for streaming
- Server Actions returning typed error unions `{ success: T } | { error: TypedError }` — this IS preferred
- `onCaughtError` logging to error monitoring service — this IS correct production error reporting
- `onUncaughtError` triggering crash reporting — this IS correct for unhandled errors
- `onRecoverableError` for hydration mismatch logging — this IS correct for recoverable errors

# Delegation
Delegate to:
- react-vite-anti-patterns for manual error state detection and legacy patterns
- react-vite-server-components for Server Action error serialization and boundary issues
- react-vite-performance for Suspense boundary placement affecting streaming performance

# Guardrails
- Never suggest removing Error Boundaries without equivalent replacement
- Do not suggest adding manual error state for patterns that Actions handle automatically
- Do not suggest throwing from Server Actions — return typed error results instead
- Preserve existing error reporting configuration unless it's missing
- Avoid suggesting overly granular Error Boundaries that create maintenance burden
- Do not assume all errors should be shown to users — some are infrastructure-only
- Respect framework-specific error handling patterns (Next.js error.tsx, Remix ErrorBoundary)