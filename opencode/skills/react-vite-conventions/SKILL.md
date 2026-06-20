---
name: react-vite-conventions
description: Naming conventions, file structure, and code consistency rules for React 19+ / Vite 8+ codebases.
---

## React 19 Conventions

| Rule | Enforce |
|---|---|
| Component naming | PascalCase (`UserProfile`, `SubmitButton`) |
| Hook naming | camelCase, `use` prefix (`useUserData`, `useFormSubmit`) |
| File naming | kebab-case or PascalCase matching primary export (`user-profile.tsx`) |
| Ref prop | `ref` as direct prop, never `forwardRef` |
| Context provider | `<Context value={...}>` directly, never `<Context.Provider>` |
| Form actions | `<form action={actionFn}>` with `useActionState`/`useFormStatus` |
| Data fetching | `use(promise)` with `<Suspense>`, never `useEffect` for fetch |
| Error boundaries | Granular per-section, never monolithic app-wide |
| Metadata | `<title>`, `<meta>`, `<link>` natively in component body |
| Resource hints | `preload`/`preinit`/`preconnect`/`prefetchDNS` from `react-dom` |

## File Structure

```
src/components/
  user-profile.tsx         # Component
  user-profile.test.tsx    # Co-located test
  user-profile.module.css  # Co-located styles

src/hooks/
  use-user-data.ts         # Shared hook

src/lib/
  api.ts                   # API client
  types.ts                 # Shared types
```

- One component per file
- Co-locate tests and styles with component
- Shared hooks in `hooks/`, not component directories
- Barrel files (`index.ts`) ONLY for public API surface — never re-export everything

## Naming Table

| Element | Convention | Example |
|---|---|---|
| Component | PascalCase noun | `UserProfile` |
| Hook | camelCase, `use` prefix | `useUserData` |
| Context | PascalCase + `Context` | `ThemeContext` |
| Event handler | camelCase, `handle` prefix | `handleSubmit` |
| Prop type | PascalCase + `Props` | `UserProfileProps` |
| File (component) | PascalCase or kebab-case | `UserProfile.tsx` |
| File (hook) | camelCase, `use` prefix | `useUserData.ts` |

## Anti-patterns

| Pattern | Fix |
|---|---|
| `forwardRef` | `ref` as direct prop |
| `<Context.Provider>` | `<Context>` directly |
| `useEffect` for data fetch | `use(promise)` + Suspense |
| `useState` for async loading | `useTransition` |
| Barrel export-all `index.ts` | Named exports only |
| `any` in props/state | Proper TypeScript types |
| Component >200 lines | Split by responsibility |
| Multiple components per file | One component per file |
| `index.tsx` as component file | Named file matching component |
