---
name: fullstack-boundary
description: Integration boundary between Effect-TS backend and React 19+ / Vite 8+ frontend — type-safe API contracts, error propagation, data serialization, Server Action wiring.
---

## Rules

| Rule | Principle |
|---|---|
| Serialization boundary | Only JSON-serializable data crosses server→client. Never Effect runtime types in client bundle. |
| Error mapping | Effect domain errors → serializable typed error unions for React Action consumption. |
| Server Actions as bridge | Run Effect programs in Server Actions, return `{ success } \| { error }`. |
| Schema contract | Effect Schema defines request/response types → derive TypeScript types for frontend. |
| Server-only Effect | All `Effect`/`Layer`/`Ref` imports in Server Components/Actions only. Never in Client Components. |
| Layer provisioning | Server Actions must provide required Layers to Effect services. |

## Anti-patterns

| Pattern | Detect | Severity |
|---|---|---|
| Effect types on client | `Effect`, `Layer`, `Ref` imports in Client Components | HIGH |
| Unmapped Effect errors | Raw Effect errors (Cause, NoSuchElementException) returned to client | HIGH |
| Non-serializable data | Effect instances, Services, Refs returned from Server Actions | HIGH |
| Direct Effect execution in client | `Effect.runPromise` in Client Components | HIGH |
| Missing error mapping layer | Server Actions throwing instead of returning typed error unions | HIGH |
| Server secrets in client | Env vars with secrets accessible in Client Components | HIGH |
| Layer not provided | Server Actions calling Effect services without required Layer | HIGH |
| Inconsistent type contracts | Frontend types not derived from Effect Schema | MEDIUM |
| Duplicate validation | Client re-validating what Schema validates on server | LOW |

## Severity

| Level | Criteria |
|---|---|
| HIGH | Bundle bloat/crash, security vulnerability, runtime error, missing dependencies |
| MEDIUM | Type drift, partial error handling, inconsistent patterns |
| LOW | Suboptimal but correct, fragile but functional |

## Output per finding
- File:line location
- Boundary violation type
- Recommended integration pattern
- Affects: frontend / backend / both
- Risk level

## Guardrails
- Never suggest importing Effect runtime in Client Components.
- Never remove error handling without equivalent serializable mapping.
- Do not duplicate client validation that Schema handles server-side unless needed for optimistic UX.
- Preserve Layer dependency structure when modifying Server Action integration.
- Respect serialization boundary — only JSON-serializable data across server→client.
