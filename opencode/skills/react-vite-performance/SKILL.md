---
name: react-vite-performance
description: Bundle optimization, render performance, Vite 8 build config, resource preloading. Concern-specific add-on.
---

## Vite 8 Build

| Setting | Reality |
|---|---|
| Default bundler | **Rolldown** (Rust, unified dev+prod) |
| Parser/transformer | **Oxc** for parsing, transforming, minifying |
| Plugin compat | Rollup-compatible plugin API |
| Legacy fallback | `builder: 'rollup'` if not migrated |
| React plugin | `@vitejs/plugin-react` v6 or swc |
| Path aliases | `resolve.tsconfigPaths: true` |

## React 19 Performance APIs

| API | Use for |
|---|---|
| `useTransition` | Non-urgent state updates |
| `useDeferredValue(value, initialValue)` | Deferred search/filter |
| `use(promise)` + Suspense | Data loading with streaming |
| `useOptimistic` | Instant UI with auto-rollback |
| `React.memo` | ONLY after profiling confirms need |
| Resource hints from `react-dom` | `preload`, `preinit`, `preconnect`, `prefetchDNS` |

## Anti-Patterns

| Pattern | Severity |
|---|---|
| Premature memoization (no profiling) | LOW |
| State too high in tree (broad re-renders) | MEDIUM |
| Missing code splitting (>50KB libs at top level) | HIGH |
| Waterfall fetching (sequential when parallel possible) | HIGH |
| No Suspense boundaries (blocking streaming SSR) | MEDIUM |
| Barrel files breaking tree-shaking | MEDIUM |
| Sync rendering block without `useTransition`/`useDeferredValue` | MEDIUM |
| Client-side fetch for SSR-available data | HIGH |
| Unoptimized resource hints (no preload/preinit) | MEDIUM |

## Guardrails

- Never suggest memoization without profiling evidence.
- Do not code-split above-fold content. Avoid over-splitting.
- Verify builder (Rolldown vs Rollup) before suggesting config.
