---
name: react-vite-server-components
description: Enforce Server/Client component boundary discipline, data-fetching architecture, and the React 19+ Server Components model in Vite 8+ projects.
---

# Purpose
This skill ensures React 19+ projects using Server Components maintain correct boundary discipline, proper data-fetching architecture, and leverage the RSC model for performance and security.

# Use when
Reviewing React 19+ / Vite 8+ code to:
- Enforce Server/Client component boundary correctness
- Design data-fetching architecture using Server Components vs Actions vs client-side fetching
- Validate `"use client"` and `"use server"` directive usage
- Ensure client-only APIs (hooks, event handlers, browser globals) don't leak into Server Components
- Validate server-only code (database, secrets, filesystem) doesn't leak to Client bundles
- Design suspense and loading architecture for streaming SSR
- Ensure proper serialization boundaries between server and client

# Inputs
- Component files with `"use client"` / `"use server"` directives
- Server Action definitions (`"use server"` functions)
- Data fetching patterns (Server Component fetch, Action fetch, client-side SWR/React Query)
- Prop types crossing server/client boundary (must be serializable)
- Vite config for SSR and Environment API usage
- Route definitions and page layouts

# Core principles
- Server Components run on the server only — they never ship JavaScript to the client
- Client Components are interactive — they run on both server (SSR) and client (hydration)
- The `"use client"` directive marks a module boundary, not individual components
- Server Actions (`"use server"`) define async functions callable from the client that execute on the server
- Props crossing the server/client boundary must be serializable (no functions, no class instances, no Symbols)
- Server Components can import and render Client Components, but Client Components cannot import Server Components
- The pattern is: Server Component fetches data → passes serializable props → Client Component handles interactivity

# Preferred patterns
- Fetch data in Server Components at the top of the tree, pass down as serializable props
- Use Server Actions for mutations via `"use server"` directive functions
- Use `useActionState` combined with `<form action={...}>` for form submissions
- Keep client-only logic (event handlers, browser APIs, React hooks) exclusively in Client Components
- Use `use(promise)` in Client Components only with promises from Suspense-powered sources
- Mark interactive components with `"use client"` at the module boundary level
- Use `<Suspense>` boundaries to stream content progressively from server
- Serialize only data — validate that no functions, class instances, or non-serializable values cross the boundary
- Use Vite 8 Environment API for multi-target builds (client + SSR + worker)

# Anti-patterns
- **Client API in Server Component**: Using `useState`, `useEffect`, `onClick`, `window`, `document`, or other client-only APIs in a Server Component (no `"use client"` directive)
- **Server-only data leak to client**: Importing database clients, environment secrets, or Node.js APIs in a Client Component bundle
- **Non-serializable prop crossing boundary**: Passing functions, class instances, or Symbols as props from Server to Client Component
- **Client Component importing Server Component**: Client Component (`"use client"`) importing and rendering a Server Component directly
- **"use client" on individual components**: Placing `"use client"` above individual component exports instead of at the module boundary
- **Unnecessary "use client"**: Marking a component as Client when it has no interactivity and could be a Server Component
- **Mixed concerns in Server Action**: Server Actions that contain UI rendering logic instead of being pure data mutation functions
- **Missing Suspense for async Server Components**: Server Components that fetch data without a Suspense boundary for streaming
- **Large client bundle from over-marking**: Marking entire modules as `"use client"` when only specific components need client interactivity
- **Waterfall fetching in Server Components**: Sequential awaits in Server Components that could be parallelized with `Promise.all`
- **Client-side data fetching for initial data**: Using useEffect + fetch for data that could be fetched in a Server Component

# Workflow
1. Identify all `"use client"` and `"use server"` directive placements and verify they are at module boundaries
2. Check Server Components for client-only API usage (hooks, event handlers, browser globals)
3. Check Client Components for server-only imports (database, secrets, Node.js APIs)
4. Verify props crossing server/client boundary are serializable (no functions, class instances, Symbols)
5. Identify unnecessary `"use client"` markings that could be Server Components
6. Check Server Actions for pure data mutation (no UI rendering logic)
7. Verify Suspense boundaries exist for all async Server Components
8. Identify waterfall data fetching that could be parallelized
9. Check for client-side data fetching patterns that should use Server Components or Actions
10. Validate Vite SSR configuration and Environment API usage for multi-target builds

# Output contract
Return findings with:
- File location and line numbers
- Specific boundary issue or architecture problem (from anti-patterns list above)
- Explanation of why it violates RSC discipline (bundle size, security, hydration, correctness)
- Recommended Server/Client architecture pattern with code example
- Risk level (low/medium/high)
- Whether it would cause a runtime error, bundle bloat, or security issue

# Severity Criteria
When assigning risk levels, use these definitions:
- **HIGH**: Server-only secrets/code leaking to client bundle, hydration mismatch from boundary violations, runtime crash from non-serializable props — will cause security vulnerabilities or runtime failures
- **MEDIUM**: Unnecessary client bundle size from over-marking `"use client"`, waterfall fetching in Server Components, missing Suspense for streaming — won't crash but degrades performance and user experience
- **LOW**: Server Component that could fetch data but doesn't, suboptimal but correct boundary placement — works but doesn't leverage RSC benefits

# Acceptable Patterns (do NOT flag)
These patterns are correct usage — do not flag them as anti-patterns:
- Server Component importing and rendering Client Component — this IS the correct composition pattern
- `"use client"` at the top of a module that contains interactive components — this IS correct module boundary marking
- Server Action (`"use server"`) as a pure async function called from Client Component — this IS correct
- `useActionState` with `<form action={...}>` for form mutations — this IS the preferred pattern
- `use(promise)` with Suspense boundary in Client Component — this IS correct when promise is from a cached source
- Serializable props (strings, numbers, booleans, arrays, plain objects, Date, null, undefined) crossing boundary — these ARE safe
- `<Suspense fallback={...}>` around async Server Components — this IS required for streaming
- Server Components that only fetch data and render markup without interactivity — this IS ideal

# Delegation
Delegate to:
- react-vite-anti-patterns for legacy API detection and general pattern violations
- react-vite-performance for bundle size analysis and render optimization
- react-vite-error-handling for Error Boundary placement around async boundaries

# Guardrails
- Never suggest converting a Client Component to Server Component if it uses hooks or event handlers
- Never suggest removing `"use client"` without verifying all exports in the module are non-interactive
- Do not suggest Server Actions for mutations that need client-side state management beyond what Actions provide
- Preserve existing Suspense boundary placements unless they are missing
- Do not suggest parallelizing data fetching unless the fetches are independent (no data dependencies between them)
- Respect framework conventions (Next.js App Router, Remix, etc.) for Server/Client boundary patterns