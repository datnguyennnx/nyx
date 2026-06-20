---
name: react-vite-error-handling
description: Error boundaries, error reporting, and recovery patterns in React 19+ / Vite 8+ with typed error strategies and graceful degradation.
---

## React 19 Error Root Options

```js
import { createRoot } from "react-dom/client"

const root = createRoot(container, {
  onCaughtError: (error, errorInfo) => {
    // Called when Error Boundary catches an error
    reportError({ type: "Caught", error, componentStack: errorInfo.componentStack })
  },
  onUncaughtError: (error, errorInfo) => {
    // Called when error is NOT caught by any Error Boundary — crash telemetry
    reportError({ type: "Uncaught", error, componentStack: errorInfo.componentStack })
  },
  onRecoverableError: (error, errorInfo) => {
    // Called for hydration mismatches and auto-recovered errors
    reportError({ type: "Recoverable", error, componentStack: errorInfo.componentStack })
  }
})
```

In React 19, errors are no longer logged twice. A single error with full context is emitted.
Server-rendered apps: use `hydrateRoot` with same options, not `createRoot`.

## Detection Table

| Anti-pattern | Detect | Severity |
|---|---|---|
| Missing `createRoot` error callbacks | No `onCaughtError`/`onUncaughtError`/`onRecoverableError` in prod | HIGH |
| Missing Error Boundary | Async ops or form mutations without wrapping Error Boundary | HIGH |
| Missing Suspense fallback | `use(promise)` or async components without `<Suspense>` boundary | HIGH |
| Double rollback | Manual rollback logic alongside `useOptimistic` auto-rollback | MEDIUM |
| Monolithic Error Boundary | Single top-level boundary instead of granular per-section | MEDIUM |
| Swallowed errors | `catch` blocks silently ignoring errors | HIGH |
| Generic error messages | Raw errors shown to users instead of typed, user-friendly messages | MEDIUM |
| Missing error type mapping | API responses directly consumed without domain error mapping | MEDIUM |

## Error Boundary Patterns

- **Form mutations:** Wrap `<form action={actionFn}>` with Error Boundary. On caught error, show inline error state.
- **Async data sections:** Each `<Suspense>` boundary should have a sibling Error Boundary.
- **Route-level:** Per-route Error Boundary for page-level failures.
- **Never:** Single app-wide catch-all that blanks the entire page on any error.

## Severity

| Level | Criteria |
|---|---|
| HIGH | Missing Error Boundary on mutation (blank screen), no prod error reporting (`onUncaughtError`) |
| MEDIUM | Monolithic boundaries, missing Suspense fallback, generic messages |
| LOW | Suboptimal granularity, verbose types that still work |

## Output per finding
- File:line location
- Error handling gap
- Recommended React 19 pattern with code example
- Affects: UX / error reporting / both
- Risk level

## Guardrails
- Never remove Error Boundaries without equivalent replacement.
- Preserve existing error reporting configuration unless missing.
- Avoid overly granular boundaries that create maintenance burden.
- `onCaughtError`/`onUncaughtError`/`onRecoverableError` should be production-only — React's dev overlay handles development.
