---
name: react-vite-anti-patterns
description: Detect legacy React patterns, stale Vite configs, component boundary violations, and modern API misuse in React 19+ / Vite 8+ codebases.
---

## React 19 Migration — Must Flag

| Legacy (FLAG) | React 19 (CORRECT) |
|---|---|
| `forwardRef` | `ref` as direct prop in function components |
| `<Context.Provider>` | `<Context value={...}>` directly |
| Manual `isPending`/`isLoading` with `useState` for async | `useTransition` automatic pending state |
| `useEffect` for data fetching | `use(promise)` with `<Suspense>` boundary |
| Promises created in render passed to `use()` | Promises from Suspense-compatible library/framework/cache |
| `onSubmit` + manual try/catch | `<form action={fn}>` with `useActionState` |
| Manual form disabled state prop drilling | `useFormStatus` from `react-dom` |
| Manual optimistic rollback logic | `useOptimistic` (auto-rollback built-in) |
| `<title>`, `<meta>`, `<link>` in `<head>` only | Render natively in component body (auto-hoisted) |
| `createRoot` without error callbacks | `onCaughtError`, `onUncaughtError`, `onRecoverableError` |

## Vite 8 Migration — Must Flag

| Legacy (FLAG) | Vite 8 (CORRECT) |
|---|---|
| `esbuild`/`rollupOptions` without checking builder | Vite 8 default builder is Rolldown. Use `rolldownOptions`. |
| `@vitejs/plugin-react` <= v5 | `@vitejs/plugin-react` v6 with Oxc transforms |
| `@vitejs/plugin-react-swc` | Still valid. Verify Oxc compatibility. |
| Manual path aliases | `resolve.tsconfigPaths: true` |
| `require()` / CJS in ESM | ESM imports only. CJS interop for external packages. |

## Detection Table

| Anti-pattern | Detect | Severity |
|---|---|---|
| Legacy ref: `forwardRef` | Use `ref` as prop in React 19 function components | MEDIUM |
| Legacy context: `<Context.Provider>` | Use `<Context value={...}>` directly | MEDIUM |
| Manual pending state | `useState` for async loading when `useTransition` works | MEDIUM |
| Render-time promise creation | `new Promise()` / `fetch()` passed to `use()` in render | HIGH |
| Effect data fetching | `useEffect` for data fetch instead of `use()` + Suspense | MEDIUM |
| Missing Error Boundary | Async ops or form mutations without wrapping Error Boundary | HIGH |
| Missing Suspense boundary | `use(promise)` without `<Suspense>` fallback | HIGH |
| Missing `createRoot` error callbacks | No `onCaughtError`/`onUncaughtError`/`onRecoverableError` | HIGH |
| Derived state duplication | `useState` mirroring computable props/state without side effects | MEDIUM |
| Stale Vite config | `esbuild`/`rollupOptions` when Rolldown is default | LOW |
| CJS import pattern | `require()` or CJS defaults in ESM environment | HIGH |
| Barrel file tree-shaking break | Re-export-all `index.ts` files breaking Rolldown | MEDIUM |
| Inline object/style in render | New references every render without memo | MEDIUM |
| Index keys on dynamic lists | Array index as `key` on reorderable/insertable lists | MEDIUM |
| God component | >200 lines mixing data, logic, layout, presentation | HIGH |
| Monolithic Error Boundary | Single app-wide boundary instead of granular per-section | MEDIUM |
| Z-index warfare | Hard-coded z-index without design system scale | LOW |
| Optimistic without rollback awareness | Manual rollback on top of `useOptimistic` auto-rollback | MEDIUM |
| Uncontrolled form without submit handler | Form elements without `action` or `onSubmit` | MEDIUM |

## Severity

| Level | Criteria |
|---|---|
| HIGH | Hydration mismatch, missing Error Boundary, data race, CJS in ESM, render-time promise creation, missing error reporting |
| MEDIUM | Performance degradation, tree-shaking break, React 19 convention violation |
| LOW | Legacy API that works, suboptimal but functionally correct |

## Output per finding
- File:line location
- Anti-pattern name (from table)
- React 19 / Vite 8 alternative with code example
- Risk level

## Guardrails
- Preserve behavioral semantics. Never remove Error Boundaries without equivalent replacement.
- Only suggest memoization when profiling confirms need.
- Do not flag patterns that exist for backward compatibility with non-React-19 libraries.
- Verify Rolldown vs Rollup builder before suggesting config changes.
