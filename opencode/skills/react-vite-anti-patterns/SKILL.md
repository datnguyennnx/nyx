---
name: react-vite-anti-patterns
description: Detect legacy React patterns, stale Vite configs, component boundary violations, and modern API misuse in React 19+ / Vite 8+ codebases.
---

# Purpose
This skill identifies anti-patterns that compromise type safety, render performance, hydration correctness, and modern API usage in React 19+ and Vite 8+ projects.

# Use when
Reviewing React 19+ / Vite 8+ source files to detect:
- Legacy React APIs that have modern replacements (forwardRef, Context.Provider, manual pending state)
- Stale Vite configuration (esbuild/rollup-specific options, CJS patterns)
- React 19 hook misuse (use() with render-time promises, optimistic state without rollback)
- Effect-heavy data fetching patterns that should use Suspense-based patterns
- Component architecture anti-patterns (god components, prop drilling, derived state duplication)
- Missing Error Boundaries and Suspense boundaries
- Barrel file patterns that break tree-shaking in Rolldown

# Inputs
- React component files (.tsx, .jsx)
- Vite configuration files (vite.config.ts, vite.config.js)
- Effect usage patterns (useEffect, useLayoutEffect)
- State management patterns (useState, useReducer)
- Import patterns and barrel files
- Build configuration and optimization settings

# Core principles
- Prefer React 19 native APIs over manual reimplementations (useTransition over manual pending state, ref prop over forwardRef)
- Leverage Vite 8 + Rolldown for build optimization — avoid patterns that defeat tree-shaking or code splitting
- Error Boundaries and Suspense are structural requirements, not optional — every async boundary needs a Suspense fallback
- Derived state should not duplicate props or state that can be computed synchronously
- Effects are last resorts for synchronization, not primary data-fetching mechanisms

# Preferred patterns
- Use `ref` as a prop directly instead of `forwardRef`
- Use `<Context>` as provider instead of `<Context.Provider>`
- Use `useOptimistic` for optimistic UI updates with automatic rollback
- Use `use(promise)` with Suspense boundaries for data loading (never create promises in render)
- Use `useFormStatus` for form submission state in design system components
- Use ref cleanup functions for DOM effect teardown
- Use React 19 document metadata hoisting (`<title>`, `<meta>`, `<link>`)
- Use Vite 8 `resolve.tsconfigPaths` for path aliases
- Use Rolldown-compatible plugin API (Rollup plugins work natively)
- Use `@vitejs/plugin-react` v6 with Oxc transforms (no Babel dependency by default)
- Use `preload`, `preinit`, `prefetchDNS`, `preconnect` for resource hints
- Use Environment API for multi-target builds (SSR, worker, client)

# Anti-patterns
- **Legacy ref pattern**: Using `forwardRef` instead of `ref` as a prop in function components
- **Legacy context provider**: Using `<Context.Provider>` instead of `<Context>`
- **Manual pending state**: Managing `isPending`/`isLoading` manually with `useState` for async mutations when `useTransition` handles it
- **Render-time promise creation**: Creating promises in render and passing to `use()` — only use promises from Suspense-powered libraries or cached sources
- **Effect data fetching**: Using `useEffect` for data fetching instead of `use()` with Suspense, or async component patterns
- **Missing Error Boundary**: Async components or mutation handlers without wrapping Error Boundary
- **Missing Suspense boundary**: Components using `use(promise)` without a parent `<Suspense>` fallback
- **Derived state duplication**: `useState` that mirrors a prop or is computable from other state/props without side effects
- **Stale Vite config**: Using `esbuild` or `rollupOptions` that have Rolldown equivalents without migrating
- **CJS import pattern**: Using `require()` or CJS default imports in Vite 8 ESM-first environment
- **Barrel file tree-shaking break**: Re-exporting everything from index files without using proper module boundary patterns that Rolldown can tree-shake
- **Inline object/style in render**: Creating new object/function references on every render that trigger unnecessary re-renders (object styles, inline callbacks without memoization)
- **Index keys on dynamic lists**: Using array index as `key` on lists that can reorder, insert, or delete items
- **God component**: Single component exceeding 200 lines mixing data fetching, business logic, layout, and presentation
- **Z-index warfare**: Hard-coded z-index values scattered across components instead of a z-index scale
- **Optimistic without rollback**: Using `useOptimistic` without providing a rollback mechanism on error (it handles this automatically — do not double-implement)
- **Uncontrolled form without submit handler**: Form elements without proper `onSubmit` handler for form mutations

# Workflow
1. Scan for legacy React API usage (`forwardRef`, `Context.Provider`, manual pending state patterns)
2. Identify effect-heavy data fetching that should migrate to Suspense-based patterns
4. Verify Error Boundary and Suspense boundary coverage for async operations
5. Check for derived state duplication (state that mirrors props or is computable without side effects)
6. Review Vite config for stale esbuild/rollup-specific options that need Rolldown migration
7. Identify barrel file patterns and inline reference patterns that hurt tree-shaking
8. Check component file size and responsibility boundaries (god components)
9. Verify list rendering keys are stable and not indices on dynamic lists
10. Document each finding with location, problem explanation, and React 19 / Vite 8 native alternative

# Output contract
Return findings with:
- File location and line numbers
- Specific anti-pattern detected (from list above)
- Explanation of why it's problematic (performance, correctness, hydration, tree-shaking)
- Recommended React 19 / Vite 8 native alternative with code example
- Risk level (low/medium/high)
- Verification notes for any React 19 / Vite 8 claims made

# Severity Criteria
When assigning risk levels, use these definitions:
- **HIGH**: Hydration mismatch, missing Error Boundary on mutation, data race from stale closure — will cause runtime failures or data corruption
- **MEDIUM**: Performance degradation from unnecessary re-renders, tree-shaking breakage, manual state management that `useTransition` handles automatically — won't crash but wrong by React 19 conventions
- **LOW**: Legacy API usage that works but isn't idiomatic, suboptimal but functionally correct patterns — code works but doesn't follow React 19 best practices

# Acceptable Patterns (do NOT flag)
These patterns are correct usage — do not flag them as anti-patterns:
- `ref` as a prop in function components — this IS the React 19 way
- `<Context value={...}>` without `.Provider` — this IS correct
- `useOptimistic` with automatic rollback on error — this IS correct
- `use(promise)` with Suspense boundaries — correct ONLY when promise is stable across renders: React Query `useSuspenseQuery`, SWR with `suspense: true`, or React `cache()`. Never pass `new Promise()` or `fetch()` directly in render.
- `useFormStatus` inside design system form components — this IS correct
- `useTransition` for non-form async state transitions — this IS appropriate
- Ref callback returning cleanup function — this IS the React 19 pattern
- Error Boundary wrapping async operations — this IS required
- `<title>`, `<meta>`, `<link>` in component body — this IS native metadata hoisting
- Vite 8 `resolve.tsconfigPaths: true` — this IS the modern path alias approach
- `@vitejs/plugin-react` v6 with Oxc — this IS the current default
- Barrel files that use named re-exports of individually imported modules —Rolldown can tree-shake these

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
- Only suggest changes that preserve behavioral semantics
- Never remove Error Boundaries without equivalent replacement
- Avoid suggesting over-memoization — only memoize when profiling shows actual performance issues
- Do not flag patterns that exist for backward compatibility with libraries not yet on React 19