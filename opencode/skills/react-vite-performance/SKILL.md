---
name: react-vite-performance
description: Render performance, bundle optimization, Vite 8+ build configuration with Rolldown, React 19+ rendering efficiency, and resource preloading.
---

## Vite 8 Build Architecture

| Setting | Vite 8 Reality |
|---|---|
| Default bundler | **Rolldown** (Rust-powered, unified dev+prod pipeline) |
| Parser/transformer | **Oxc** for parsing, transforming, minifying |
| Plugin compatibility | Rollup-compatible plugin API. Rolldown natively supports existing Rollup plugins. |
| Legacy fallback | `builder: 'rollup'` for projects not yet migrated. Use `rollupOptions` only when Rollup builder is active. |
| React plugin | `@vitejs/plugin-react` v6 or `@vitejs/plugin-react-swc`. Oxc transforms, `jsxRuntime: 'automatic'`. |
| Path aliases | `resolve.tsconfigPaths: true` instead of manual alias config |

## React 19 Performance APIs

| API | Use for |
|---|---|
| `useTransition` | Non-urgent state updates — keeps UI responsive during async work |
| `useDeferredValue(value, initialValue)` | Deferred search/filter inputs. `initialValue` for first render. |
| `use(promise)` + Suspense | Data loading with streaming. Promise must be cached/stable — never created in render. |
| `useOptimistic` | Instant UI feedback with automatic error rollback |
| `React.memo` | ONLY after profiling confirms unnecessary re-renders |
| `prefetchDNS`, `preconnect`, `preload`, `preinit` (from `react-dom`) | Resource hints for fonts, scripts, stylesheets, API origins |

## Detection Table

| Anti-pattern | Detect | Severity |
|---|---|---|
| Premature memoization | `React.memo`/`useMemo`/`useCallback` without profiling evidence | LOW |
| State in ancestor | State high in tree when only leaves need it → broad re-renders | MEDIUM |
| Inline reference creation | New objects/functions in render triggering child re-renders | MEDIUM |
| Missing code splitting | Heavy libs (>50KB, charting, editors) imported at top level | HIGH |
| Waterfall data fetching | Sequential `await` chains that could be `Promise.all` | HIGH |
| No Suspense boundaries | Monolithic or absent boundaries preventing streaming SSR | MEDIUM |
| Over-bundling | Single large chunk instead of vendor/app splitting | HIGH |
| Barrel file tree-shaking break | Re-export-all `index.ts` files preventing Rolldown tree-shaking | MEDIUM |
| Sync rendering block | Heavy compute in render path without `useTransition`/`useDeferredValue` | MEDIUM |
| Unoptimized resource loading | No `preload`/`preinit` hints for critical fonts, scripts, styles | MEDIUM |
| Client-side fetch for SSR data | Client `fetch` for data available at request time on server | HIGH |
| Index keys on dynamic lists | Array index keys on reorderable lists causing reconciliation issues | LOW |
| Stale Vite config | `esbuild`/`rollupOptions` without checking builder | LOW |

## Metrics

| Threshold | Severity |
|---|---|
| Initial bundle >500KB uncompressed | HIGH |
| Visible rendering lag >100ms | HIGH |
| Sequential fetching adding >1s LCP | HIGH |
| Unnecessary re-renders across multiple components | MEDIUM |
| Missing code splitting for >50KB dependencies | MEDIUM |

## Severity

| Level | Criteria |
|---|---|
| HIGH | Measurable performance regression (bundle, LCP, rendering lag) |
| MEDIUM | Performance degradation under load, missing optimization |
| LOW | Premature optimization, suboptimal but functional |

## Output per finding
- File:line location
- Performance issue
- Estimated impact with metric
- Recommended optimization with code example
- Requires: code change / config change / both

## Guardrails
- Never suggest memoization without profiling evidence or clear heuristic (>5 re-renders/sec).
- Do not code-split above-fold content.
- Avoid over-splitting — many tiny chunks create network overhead.
- Preserve Suspense boundaries unless missing or monolithic.
- Verify builder (Rolldown vs Rollup) before suggesting `rolldownOptions` vs `rollupOptions`.
