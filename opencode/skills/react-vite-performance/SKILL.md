---
name: react-vite-performance
description: Diagnose and fix render performance, bundle optimization, Vite 8+ build configuration, and React 19+ rendering efficiency issues.
---

# Purpose
This skill ensures React 19+ / Vite 8+ applications achieve optimal runtime render performance, bundle size, and build configuration by leveraging modern APIs and Rolldown optimization.

# Use when
Reviewing React 19+ / Vite 8+ code to:
- Optimize component re-render behavior (unnecessary re-renders, memoization, state locality)
- Configure Vite 8 build optimization (Rolldown chunk splitting, code splitting, tree-shaking)
- Leverage React 19 rendering APIs (useTransition, useDeferredValue, Suspense streaming)
- Optimize data fetching patterns (parallel fetching, streaming SSR, progressive loading)
- Configure resource loading (preload, preinit, prefetchDNS, preconnect)
- Reduce client bundle size (Server Components, dynamic imports, proper `"use client"` boundaries)
- Identify and fix hydration performance issues

# Inputs
- React component files with render patterns (re-renders, memoization usage)
- Vite configuration files (vite.config.ts)
- Bundle analysis reports (Rolldown visualizer, chunk sizes)
- Network waterfall data (sequential vs parallel fetching)
- Component tree depth and composition patterns
- Dynamic import patterns and code splitting configuration
- Resource loading strategy (fonts, images, scripts, stylesheets)
- SSR streaming configuration

# Core principles
- React 19 Actions and useTransition handle pending state and re-render prioritization automatically — don't reinvent manually
- Re-render optimization starts with state locality — push state down to the components that need it
- Memoization (React.memo, useMemo, useCallback) is a last resort after state locality and composition
- Server Components reduce client bundle size by shipping zero JavaScript for static content
- Rolldown tree-shaking requires proper module boundaries — avoid barrel files that re-export everything
- Code splitting should be at route boundaries by default, lazy-loaded for below-fold content
- Resource loading should use Vite 8 preload APIs (preinit, preload) for critical resources
- Streaming SSR with Suspense boundaries provides progressive page load

# Preferred patterns
- Use `useTransition` for non-urgent state updates to keep UI responsive
- Use `useDeferredValue` with initial value for search/filter inputs
- Use `React.memo` only after profiling confirms unnecessary re-renders
- Push state down to leaf components to minimize re-render scope
- Use Server Components for static content to eliminate client JavaScript
- Use dynamic `import()` for route-level code splitting and below-fold content
- Configure Rolldown `output.manualChunks` for vendor splitting
- Use `preload` and `preinit` from `react-dom` for critical resource hints
- Use `<link rel="stylesheet" precedence="...">` for stylesheet ordering
- Use Suspense boundaries for streaming progressive content
- Use Vite 8 `resolve.tsconfigPaths` instead of manual alias configuration
- Use `@vitejs/plugin-react` v6 with Oxc for fast React Refresh transforms
- Use Rolldown-compatible plugin API (existing Rollup plugins work natively)

# Anti-patterns
- **Premature memoization**: Adding `React.memo`, `useMemo`, `useCallback` without profiling evidence of render performance issues
- **State in ancestor components**: Placing state high in the tree when only leaf components need it, causing broad re-renders
- **Inline reference creation**: Creating new object/function references in render that trigger child re-renders (inline styles, callbacks without stable reference)
- **Missing code splitting**: Importing entire heavy libraries (charting, editors) at the top level instead of lazy-loading
- **Waterfall data fetching**: Sequential `await` calls in Server Components that could be parallelized with `Promise.all`
- **No Suspense boundaries**: Monolithic Suspense boundaries or none at all, preventing streaming content
- **Over-bundling**: Single large chunk instead of vendor splitting for framework, UI library, and app code
- **Barrel file tree-shaking break**: Large index.ts files that re-export everything, preventing Rolldown from eliminating unused code
- **Synchronous rendering block**: Heavy computation in render path without `useTransition` or `useDeferredValue` deferral
- **Unoptimized resource loading**: No preload/preinit hints for critical fonts, scripts, or stylesheets
- **Client-side data fetching for SSR content**: Using client-side fetch for data available at request time on the server
- **Missing key warnings**: Using index keys on dynamic lists causing reconciliation issues

# Workflow
1. Profile component re-render behavior — identify components re-rendering unnecessarily
2. Check state placement — is state at the lowest possible level in the tree?
3. Identify components with `React.memo`, `useMemo`, `useCallback` — verify with profiling data, flag premature memoization
4. Analyze bundle composition — check for missing code splitting, over-bundling, barrel file issues
5. Review data fetching patterns — sequential awaits that could be parallelized, client-side fetching for SSR-available data
6. Check Suspense boundary placement — are there granular boundaries for streaming?
7. Verify resource loading strategy — preload/preinit hints for critical resources
8. Review Vite config — Rolldown configuration, plugin compatibility, tsconfig paths, optimization settings
9. Check dynamic import patterns — route-level splitting and below-fold lazy loading
10. Document each finding with location, performance impact, and recommended optimization

# Output contract
Return findings with:
- File location and line numbers
- Specific performance issue (from anti-patterns list above)
- Explanation of performance impact (render cost, bundle size, network waterfall, hydration delay)
- Recommended optimization with code example
- Estimated impact (low/medium/high based on profiling data or heuristic)
- Whether it requires code changes, config changes, or both

# Severity Criteria
When assigning risk levels, use these definitions:
- **HIGH**: Bundle size >500KB uncompressed for initial load, visible rendering lag >100ms, sequential data fetching adding >1s LCP — measurable performance regression
- **MEDIUM**: Unnecessary re-renders affecting multiple components, missing code splitting for heavy dependencies, barrel files preventing tree-shaking — performance degradation under load
- **LOW**: Premature memoization that doesn't hurt yet, suboptimal chunk splitting, missing resource hints — works but doesn't follow best practices

# Acceptable Patterns (do NOT flag)
These patterns are correct usage — do not flag them as anti-patterns:
- `React.memo` on components that profiling confirms re-render unnecessarily — this IS justified memoization
- `useMemo` for expensive computations that profiling confirms are costly — this IS correct
- `useCallback` for callbacks passed to memoized children — this IS correct when children are memoized
- `useTransition` for non-urgent state updates — this IS correct prioritization
- `useDeferredValue` with initial value for search inputs — this IS correct deferral
- Dynamic `import()` for route-level code splitting — this IS recommended
- Server Components for static content — this IS the ideal pattern for reducing client bundle
- Suspense boundaries around async content — this IS required for streaming
- Vite 8 Rolldown `output.manualChunks` for vendor splitting — this IS recommended
- `preload`/`preinit` for critical resources — this IS recommended resource loading

# Delegation
Delegate to:
- react-vite-anti-patterns for legacy API detection and general pattern violations
- react-vite-server-components for Server Component boundary issues affecting bundle size
- react-vite-error-handling for Error Boundary placement affecting error recovery UX

# Guardrails
- Never suggest memoization without profiling evidence or clear heuristic justification
- Do not suggest code splitting for components that render above the fold on initial load
- Avoid over-splitting chunks — too many small chunks creates network overhead
- Do not suggest converting client components to Server Components if they need interactivity
- Preserve existing Suspense boundary placements unless they are missing or monolithic
- Do not suggest removing barrel files without verifying the module boundary patterns are preserved
- Respect framework-specific patterns (Next.js App Router, Remix, etc.) for code splitting and loading