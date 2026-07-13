---
name: fullstack-boundary
description: Integration boundary between Effect-TS backend and React 19+ / Vite 8+ frontend. Concern-specific add-on.
---

## Rules

| Rule | Principle |
|---|---|
| Serialization boundary | Only JSON-serializable data crosses server→client. No Effect types in client bundle. |
| Error mapping | Effect domain errors → serializable typed error unions for React Actions. |
| Server Actions as bridge | Run Effect in Server Actions, return `{ success } \| { error }`. |
| Schema contract | Effect Schema defines request/response → derive TS types for frontend. |
| Server-only Effect | All Effect/Layer/Ref imports in Server Components/Actions only. Never in Client Components. |
| Layer provisioning | Server Actions must provide required Layers to Effect services. |

## Anti-Patterns

| Pattern | Severity |
|---|---|
| Effect types in Client Components | HIGH |
| Raw Effect errors (Cause, NoSuchElementException) to client | HIGH |
| Non-serializable data from Server Actions | HIGH |
| `Effect.runPromise` in Client Components | HIGH |
| Layer not provided before Effect execution | HIGH |
| Server secrets accessible in Client Components | HIGH |
| Frontend types not derived from Effect Schema | MEDIUM |
| Client re-validating what Schema validates server-side | LOW |

## Guardrails

- Never import Effect runtime in Client Components.
- Never remove error mapping — always serialize errors.
- Only JSON-serializable data crosses server→client boundary.
- Preserve Layer dependency structure when modifying Server Actions.
