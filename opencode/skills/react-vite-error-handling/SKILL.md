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
- Validate that `useOptimistic` has correct rollback behavior on error
- Handle suspension and loading states with Suspense boundaries
- Configure Vite 8 error handling for SSR, build, and dev server
- Design typed error strategies for API responses and domain errors

# Inputs
- Error Boundary component implementations and placements
- React root creation options (`createRoot`) for error callbacks
- Form submission error handling
- `useOptimistic` rollback patterns
- Suspense boundary placements
- API error response types and error mapping
- Vite configuration for error handling (dev server, SSR, build)

# Core principles
- Error Boundaries are structural requirements, not optional — every async boundary needs one
- React 19 distinguishes caught errors (in Error Boundary), uncaught errors, and recoverable errors — handle each differently
- `useOptimistic` automatically rolls back on error — don't double-implement rollback logic
- Suspense boundaries must be placed at meaningful UI boundaries to enable progressive loading
- Build-time errors (Vite) and runtime errors (React) require different strategies

# Preferred patterns
- Use React 19 `createRoot(container, { onCaughtError, onUncaughtError, onRecoverableError })` for structured error reporting
- Wrap async operations with `<ErrorBoundary>` and `<Suspense>` at meaningful UI boundaries
- Let `useOptimistic` handle automatic rollback on error — do not add manual rollback logic
- Create typed error classes for domain errors (ValidationError, AuthError, NetworkError) with actionable messages
- Use `use(promise)` inside `<Suspense>` for data loading — let the Suspense boundary handle the loading and error states
- Configure Vite 8 `server.hmr` and `server.middlewareMode` for dev error handling
- Use Error Boundary composition — nested boundaries for fine-grained recovery
- Return structured error types from form submission handlers for client-side typed error handling

# Anti-patterns
- **Missing Error Boundary**: Async operations or form submissions without Error Boundary wrapping
- **Missing Suspense fallback**: `use(promise)` or async components without `<Suspense>` boundary
- **Double rollback implementation**: Adding manual rollback logic alongside `useOptimistic` which already handles automatic rollback
- **Catch-all error boundaries**: Single top-level Error Boundary instead of granular boundaries at meaningful UI sections
- **Swallowed errors**: `catch` blocks that silently ignore errors without logging or user notification
- **Generic error messages**: Showing raw error messages to users instead of user-friendly typed error messages
- **Missing error type mapping**: API responses returned directly without mapping to domain error types
- **No error reporting**: Production errors not reported to monitoring (onCaughtError, onUncaughtError not configured)

# Workflow
1. Identify all Error Boundary placements and verify coverage for async operations
2. Check React root creation for `onCaughtError`, `onUncaughtError`, `onRecoverableError` configuration
3. Check `useOptimistic` usage for correct automatic rollback (no manual double-rollback)
5. Verify Suspense boundaries exist around all `use(promise)` calls and async components
6. Check for swallowed errors in catch blocks
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
- **HIGH**: Missing Error Boundary on mutation handlers (errors crash entire page), no error reporting in production — will cause blank screens or unhandled errors
- **MEDIUM**: Single monolithic Error Boundary (coarse recovery), missing Suspense fallback (loading flash), generic error messages — degrades error recovery UX
- **LOW**: Suboptimal Error Boundary granularity that still works, verbose error types that could be simplified, missing error type mapping that still surfaces meaningful messages — works but doesn't follow best practices

# Acceptable Patterns (do NOT flag)
These patterns are correct usage — do not flag them as anti-patterns:
- `createRoot(domNode, { onCaughtError, onUncaughtError, onRecoverableError })` — this IS React 19 error reporting
- `useOptimistic` with automatic rollback on error — this IS correct, no manual rollback needed
- Nested `<ErrorBoundary>` at meaningful UI sections — this IS recommended granular recovery
- `<Suspense fallback={...}>` around async content — this IS required for streaming
- `onCaughtError` logging to error monitoring service — this IS correct production error reporting
- `onUncaughtError` triggering crash reporting — this IS correct for unhandled errors
- `onRecoverableError` for hydration mismatch logging — this IS correct for recoverable errors

# Related Skills
Orchestrator may load these based on task shape — skills do not delegate directly:
- react-vite-anti-patterns: legacy API detection, tree-shaking issues
- react-vite-performance: render performance, bundle optimization
- react-vite-error-handling: Error Boundary and Suspense coverage

# Vite 8 Build Context
- Default builder: Rollup (Vite 8 default — Rolldown is opt-in)
- Rolldown opt-in: explicit `builder: 'rolldown'` in vite.config.ts required
- When Rolldown active: use `rolldownOptions` (not `rollupOptions`)
- When Rolldown NOT active: use `rollupOptions` as before
- `@vitejs/plugin-react` v6 with Oxc: requires `jsxRuntime: 'automatic'`

# Guardrails
- Never suggest removing Error Boundaries without equivalent replacement
- Preserve existing error reporting configuration unless it's missing
- Avoid suggesting overly granular Error Boundaries that create maintenance burden
- Do not assume all errors should be shown to users — some are infrastructure-only