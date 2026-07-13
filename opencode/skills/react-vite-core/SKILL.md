---
name: react-vite-core
description: React 19+ / Vite 8+ conventions, anti-patterns, error handling. Core skill for any React work.
---

## React 19 Conventions

| Rule | Enforce |
|---|---|
| Component naming | PascalCase (`UserProfile`) |
| Hook naming | camelCase, `use` prefix |
| File naming | kebab-case matching primary export |
| Ref prop | Direct `ref` prop, never `forwardRef` |
| Context provider | `<Context value={...}>` directly, never `<Context.Provider>` |
| Form actions | `<form action={fn}>` with `useActionState`/`useFormStatus` |
| Data fetching | `use(promise)` + `<Suspense>`, never `useEffect` for fetch |
| Error boundaries | Granular per-section, not monolithic app-wide |
| Metadata | `<title>`/`<meta>`/`<link>` natively in component body |

## File Structure

```
src/components/user-profile.tsx       # Component
src/components/user-profile.test.tsx  # Co-located test
src/components/user-profile.module.css # Co-located styles
src/hooks/use-user-data.ts            # Shared hook
```
One component per file. Co-locate tests + styles. Barrel files ONLY for public API surface.

## React 19 Migration — Must Flag

| Legacy (FLAG) | React 19 (CORRECT) |
|---|---|
| `forwardRef` | `ref` as direct prop |
| `<Context.Provider>` | `<Context value={...}>` |
| `useEffect` for data fetching | `use(promise)` + Suspense |
| `useState` for async loading | `useTransition` |
| `onSubmit` + manual try/catch | `<form action={fn}>` + `useActionState` |
| Manual optimistic rollback | `useOptimistic` (auto-rollback) |
| Manual form disabled state | `useFormStatus` |
| `createRoot` without error callbacks | `onCaughtError`/`onUncaughtError`/`onRecoverableError` |
| Promises created in render | Promises from Suspense-compatible library/cache |

## Vite 8 Migration — Must Flag

| Legacy (FLAG) | Vite 8 (CORRECT) |
|---|---|
| `esbuild`/`rollupOptions` without checking builder | `rolldownOptions` (Rolldown is Vite 8 default) |
| `@vitejs/plugin-react` <= v5 | v6 with Oxc transforms |
| Manual path aliases | `resolve.tsconfigPaths: true` |
| `require()` / CJS in ESM | ESM imports only |

## Error Boundary Patterns

- Form mutations: Wrap `<form action={actionFn}>` with Error Boundary
- Async data sections: Each `<Suspense>` needs sibling Error Boundary
- Route-level: Per-route Error Boundary for page failures
- Never: Single app-wide catch-all that blanks entire page
- `createRoot` MUST include `onCaughtError`, `onUncaughtError`, `onRecoverableError` in production

## Anti-Patterns (HIGH severity)

| Pattern | Severity |
|---|---|
| Effect data fetching (`useEffect` instead of `use()`+Suspense) | MEDIUM |
| Missing Error Boundary on async ops/mutations | HIGH |
| Missing `createRoot` error callbacks | HIGH |
| Render-time promise creation (fetch in render body) | HIGH |
| Missing Suspense boundary with `use(promise)` | HIGH |
| CJS import in ESM environment | HIGH |
| God component >200 lines | HIGH |
| Swallowed errors in catch blocks | HIGH |
| Generic error messages shown to users | MEDIUM |
| Monolithic Error Boundary | MEDIUM |
| Stale Vite config (builder mismatch) | LOW |

## Guardrails

- Never remove Error Boundaries without equivalent replacement.
- Preserve behavioral semantics when migrating.
- Verify Rolldown vs Rollup builder before suggesting config changes.
