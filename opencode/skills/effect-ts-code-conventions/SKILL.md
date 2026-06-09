---
name: effect-ts-code-conventions
description: Enforce idiomatic Effect-TS coding style covering pattern matching, Effect.gen usage, naming conventions, file/module structure, Schema-first design, and code formatting.
---

# Companion Skill
Load `effect-ts` alongside this skill for research strategy, installation guidelines, and access to detailed reference guides covering all Effect domains. The main `effect-ts` skill provides the canonical research methodology: local guides first → codebase patterns → Effect source code. This skill is the exclusive source of truth for idiomatic code style; the main skill provides the general-purpose research framework.

Load `effect-ts-anti-patterns` alongside this skill for automated low-level syntax correction (e.g., Promise-first code, hidden service dependencies, oversized Effect.gen blocks). The anti-patterns skill detects violations; this skill prescribes the correct stylistic alternative.

# Purpose
This skill defines idiomatic Effect-TS coding style and conventions. It ensures developers and agents write Effect code that is consistent, readable, type-safe, and follows the patterns established by the official Effect documentation at https://effect.website/. The skill covers everything from pattern matching hygiene to module structure to Schema-first design principles.

# Use when
- Writing new Effect-TS code and deciding which style to use (pipe vs gen, dual vs data-first, etc.)
- Reviewing Effect code for stylistic correctness and consistency with official docs.
- Refactoring legacy or non-idiomatic Effect code.
- Setting up project conventions for Effect-TS modules.
- Deciding on naming and file organization for services, layers, errors, and schemas.

# Inputs
- Effect-TS source files requiring code review.
- New module or service definitions.
- Pattern matching expressions, Effect.gen blocks, or pipe chains.
- Error type definitions and Schema declarations.
- File and module organization proposals.

# Core principles

Idiomatic Effect-TS code is governed by a core narrative: **choose the right abstraction for the job, write it clearly, and let the types guide you.**

- **Pattern Matching over Imperative Branching:** Replace `if/else` and `switch` chains with `Match.type`, `Match.value`, and their combinators. Pattern matching gives you exhaustiveness checking, composable conditions, and a declarative style. The `Match` module is your default branching tool — use it for union discrimination, type narrowing, and value-based dispatching.

- **Effect.gen for Sequential Readability, Pipe for Transformations:** `Effect.gen` allows imperative-style code that reads top-to-bottom without nesting. Use it when you need to sequence multiple effectful steps with intermediate variables. Use `pipe` chains when you are transforming a value through a series of pure function applications. Do NOT nest `pipe` calls deeper than 3 levels — that is a signal to switch to `Effect.Do` or `Effect.gen`.

- **Single Responsibility in Effect.gen blocks:** Each `Effect.gen` block should do one thing. If you find yourself mixing input validation, business logic, IO, and error mapping in one block, extract into named helper functions. The `yield*` operator is not a substitute for function decomposition.

- **Dual APIs are a Feature, Not a Confusion:** Effect exposes both data-first and data-last overloads for most operations. Use data-last (`pipe(effect, Effect.map(fn))`) for multi-step transformation chains. Use data-first (`Effect.map(effect, fn)`) for single operations. Both are correct; choose for readability.

- **Avoid Tacit (Point-Free) Style:** Never write `Effect.map(fn)` when you mean `Effect.map((x) => fn(x))`. Tacit usage can erase generics, break TypeScript inference, and produce unclear stack traces. Always wrap function references in an explicit lambda unless the function is a type-safe refinement or the identity function.

- **Branded Types for Domain Safety, not Framework Interop:** Use `Brand.nominal` to distinguish structurally identical types (User ID vs Product ID). Use `Brand.refined` when runtime validation is also needed (PositiveInt, NonEmptyString). Use `Brand.all` to combine multiple brands. Do NOT use branded types as a general-purpose validation framework — that is what Schema is for.

- **Schema-First Design:** Define your data models as `Schema` objects first, then derive TypeScript types from them using `Schema.Type`. Never duplicate type definitions. A single `Schema` is the source of truth for validation, serialization, type generation, and documentation.

- **Names Tell the Story:** Service names are nouns (UserService, PaymentGateway). Layer constructors follow the pattern `ServiceNameLayer` (UserServiceLive, PaymentGatewayTest). Error types are tagged unions with a `_tag` discriminant using `Schema.TaggedError`. File names match the primary export (lowercase kebab-case: `user-service.ts`, `payment-gateway.ts`, `user-errors.ts`).

# Preferred patterns

### Pattern Matching

- **`Match.type<T>()`** for matching against a known union type. Always end with `Match.exhaustive` when all cases are known, or `Match.orElse` for a fallback.

- **`Match.value(value)`** for matching against a specific concrete value. Useful for literal matching on strings, numbers, or objects.

- **`Match.when(pattern, handler)`** as the primary condition combinator. Use literal patterns for exact matching, predicate functions for runtime checks, and `Match.not(predicate)` for negation.

- **`Match.tag`** for discriminated union matching by `_tag` field. This is the Effect-idiomatic way to switch on tagged union variants.

```typescript
// Preferred: Match.tag for discriminated unions
const result = Match.type<MyUnion>().pipe(
  Match.tag("Success", (s) => s.value),
  Match.tag("Failure", (f) => f.message),
  Match.exhaustive
)
```

- **`Match.withReturnType<T>()`** as the first call in the pipeline to enforce a consistent return type across all branches.

- **`Match.option` / `Match.either`** when you want to preserve unmatched cases as `Option` or `Either` rather than throwing or providing a fallback.

- **Built-in predicates** (`Match.number`, `Match.string`, `Match.boolean`, `Match.symbol`, `Match.undefined`, `Match.null`, `Match.instanceOf`) for type-based matching.

### Effect.gen Usage

- **Keep blocks short:** Each `Effect.gen` block should fit in a single screen. If it doesn't, extract steps into named effects.

- **Single yield* per line:** Do not chain `yield*` calls on the same line. Each `yield*` gets its own line with a clear variable name.

```typescript
// Preferred
const user = yield* findUser(id)
const account = yield* getAccount(user.accountId)
const result = yield* processPayment(account, amount)

// Avoid
const result = yield* processPayment(yield* getAccount((yield* findUser(id)).accountId), amount)
```

- **Error handling at the boundaries:** Use `Effect.catchTag` or `Effect.catchAll` immediately after the `Effect.gen` block, not deep inside it. This keeps the happy path clean.

- **Use `Effect.Do` + `Effect.bind` for intermediate results** when you need to accumulate multiple values and pass them through a pipeline. `Effect.gen` is the monadic equivalent — prefer `Effect.gen` for imperative readability when you have 3+ steps.

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Service interface | PascalCase, noun | `UserService` |
| Service Tag | PascalCase, same as interface | `UserService` |
| Service implementation | PascalCase, suffixed with Impl or descriptive | `UserServiceImpl` or `UserServiceLive` |
| Layer | PascalCase, suffixed with Layer | `UserServiceLiveLayer` |
| Layer (test/mock) | PascalCase, suffixed with Test | `UserServiceTestLayer` |
| Error type | PascalCase, `Schema.TaggedError` | `UserNotFoundError` |
| Error module | PascalCase, plural Errors | `UserErrors` |
| Schema | PascalCase, noun | `UserSchema` |
| File name | kebab-case, matches primary export | `user-service.ts` |
| Effect functions | camelCase, verb phrase | `findUser`, `processPayment` |

### File / Module Structure

```
src/
  user/
    user-service.ts        # Service interface + Tag
    user-service-live.ts   # Live implementation + Layer
    user-service-test.ts   # Test implementation + Layer
    user-errors.ts         # Tagged error types (Schema.TaggedError)
    user-schema.ts         # Schema definitions
    user-types.ts          # Simple type aliases (no schemas needed)
```

- One concern per file. Keep services, layers, errors, and schemas in separate files.
- Export the service interface and Tag from the same module; import them together.
- Layer files export a single default layer and optionally named layers for different environments.

### Pipe vs Gen Tradeoffs

- **Use `pipe` for:**
  - Simple transformations on the success channel (map, filter, flatMap).
  - Composing with `Effect.catchTag`, `Effect.timeout`, `Effect.retry`.
  - Short chains (2-3 operations) where nesting stays flat.

- **Use `Effect.gen` for:**
  - Sequences of 3+ effectful steps where each step depends on the previous.
  - Mixing error handling, branching, and resource management.
  - Code where imperative readability matters more than pipeline composability.
  - Blocks that need conditional logic (if/else, loops).

- **Use `Effect.Do` + `Effect.bind` for:**
  - Accumulating named intermediate values in a pipeline context.
  - Interop between pipe-based code and generator-based code.

### Schema-First Design

```typescript
import { Schema } from "@effect/schema"

// Define once as Schema
export const UserSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  age: Schema.Number
})

// Derive the type — never write it manually
export interface User extends Schema.Type<typeof UserSchema> {}

// Use for validation, encoding, decoding
Schema.decode(UserSchema)(input)   // Effect<User, ParseError>
Schema.encode(UserSchema)(user)    // Effect<unknown, ParseError>
```

- Use `Schema.TaggedError` for domain error types to get automatic `_tag` and `message` fields.
- Use `Schema.Data` for value equality on data carriers.
- Use `Schema.Class` when you need prototype methods alongside schema definitions.

### Code Formatting Best Practices

- Use `Effect.fn` (annotated functions) for service implementations that need tracing span names.
- Group imports: `"effect"` imports first, then `"@effect/*"` packages, then application modules.
- Use `export const` for service Tags and layer constructors. Use `export interface` for service shape.
- Layer definitions use `Layer.effect(ServiceTag, Effect.gen(...))` for resourceful layers. Use `Layer.succeed` for pure service instances.
- Pipeline chains: one operation per line, aligned by the `.pipe(` opener.
- Never mix `Effect.gen` and `pipe` in the same expression. If you start with `Effect.gen`, use `yield*`. If you start with `pipe`, stay in pipe-land.

# Anti-patterns

- **Deeply Nested Pipe Calls:** More than 3 levels of nested `.pipe(` calls creates unreadable "callback hell". Extract into intermediate variables or switch to `Effect.gen`.

- **Mixing `Effect.gen` and `.pipe()` Inside the Same Expression:** This creates confusing dual-context code. Pick one style for the scope.

```typescript
// Avoid
const result = yield* Effect.gen(function*() {
  const x = yield* getX()
  return pipe(x, Effect.map((v) => v + 1)) // mixing styles
})

// Prefer
const result = yield* Effect.gen(function*() {
  const x = yield* getX()
  const mapped = yield* Effect.map(x, (v) => v + 1) // data-first, stays in gen
  return mapped
})
```

- **Tacit (Point-Free) Function Arguments:** `Effect.map(filterUsers)` instead of `Effect.map((users) => filterUsers(users))`. This breaks type inference and generics. Always wrap in a lambda.

- **`switch` Statements on Discriminated Unions:** Using raw `switch` on `_tag` instead of `Match.tag`. Raw `switch` lacks exhaustiveness checking and composability.

```typescript
// Avoid
switch (event._tag) {
  case "UserCreated": return handleCreate(event)
  case "UserDeleted": return handleDelete(event)
}

// Prefer
Match.value(event).pipe(
  Match.tag("UserCreated", (e) => handleCreate(e)),
  Match.tag("UserDeleted", (e) => handleDelete(e)),
  Match.exhaustive
)
```

- **Manual Brand Implementation:** Writing `const BrandTypeId = Symbol.for("effect/Brand")` by hand. Use `Brand.nominal<BrandedType>()` or `Brand.refined<BrandedType>()` from the `Brand` module.

- **Duplicate Type Definitions:** Writing both a TypeScript type and an equivalent Schema by hand. Define the Schema once and derive `Schema.Type`.

- **Giant Effect.gen Blocks:** A single `Effect.gen` block that handles validation, IO, error mapping, logging, and response formatting. Extract helper effects and compose them.

- **Data-First in a Multi-Step Chain:** `Effect.map(Effect.flatMap(Effect.map(effect, f1), f2), f3)` — this nests right-to-left and is unreadable. Use `pipe(effect, Effect.map(f1), Effect.flatMap(f2), Effect.map(f3))` or `Effect.gen`.

- **Omitting `Match.exhaustive` on Known Unions:** Using `Match.orElse` when all variants of a union are known. `Match.exhaustive` gives compile-time safety: adding a new union variant will produce a type error at every match site.

- **Inline Effect.runSync in Production Code:** Calling `Effect.runSync` inside services or layers. This is a mid-flight execution anti-pattern (see `effect-ts-principle-thinking`). Only use `Effect.runSync` in pure unit tests.

- **Using `Effect.Do` when `Effect.gen` Would Be Clearer:** If you have 5+ `Effect.bind` calls, switch to `Effect.gen`. The `Do` simulation stops being readable past 3-4 binds.

- **File Named After TypeScript Internal**: Files named `types.ts` or `errors.ts` that accumulate unrelated types/errors. Each file should be named after the domain concept it represents (`user-types.ts`, `payment-errors.ts`).

# Workflow

1. **Inspect Style Choice:** Identify whether the code uses `Match`, `Effect.gen`, `pipe`, or `Effect.Do`. Check if the choice fits the complexity of the logic (short chains → pipe, long sequences → gen).

2. **Check Pattern Matching Hygiene:** For every `Match.when`, verify that `Match.exhaustive` or `Match.orElse` terminates the match. Check that `Match.withReturnType` is used when branch return types must agree. Ensure `Match.tag` is used for discriminated unions, not raw `switch`.

3. **Evaluate Effect.gen Boundaries:** Assess if any `Effect.gen` block is too long or mixes too many responsibilities. Check for nested `pipe` inside `gen`. Verify each `yield*` is on its own line.

4. **Audit Naming and File Structure:** Verify service/layer/error naming follows the table in Preferred Patterns. Check that files are organized by domain and named kebab-case.

5. **Validate Schema-First:** Confirm that all data models have a `Schema` definition and types are derived, not duplicated. Check that `Schema.TaggedError` is used for domain errors.

6. **Fix Tacit Usage:** Scan for point-free function references in `Effect.map`, `Effect.flatMap`, `Effect.filter`, etc. Wrap in explicit lambdas.

7. **Recommend & Refactor:** For each violation, provide the correct idiomatic pattern with a code example showing the before and after.

# Output contract

Return findings with:
- Stylistic issue identified (e.g., "Deeply nested pipe", "Missing Match.exhaustive", "Tacit function usage").
- Explanation of why the pattern is non-idiomatic (impact on readability, type safety, or maintainability).
- Code example showing the correct idiomatic pattern.
- Verification steps to confirm the fix follows Effect conventions.

# Severity Criteria

- **HIGH:** Missing `Match.exhaustive` on a known union (allows invalid states to compile); Tacit function calls that erase generics and cause runtime type errors; Duplicate type definitions (Schema and manual type drift); `Effect.runSync` in production service code.
- **MEDIUM:** Deeply nested `pipe` chains (4+ levels); Mixing `Effect.gen` and `pipe` in the same expression; Giant `Effect.gen` blocks with multiple responsibilities; Using raw `switch` instead of `Match.tag`.
- **LOW:** Inconsistent file naming (PascalCase vs kebab-case); Data-first style in multi-step chains; Missing `Effect.fn` span annotations on service methods; Using `Effect.Do` when `Effect.gen` would be shorter.

# Acceptable Patterns (do NOT flag)

- Data-first style (`Effect.map(effect, fn)`) for single-operation expressions — this is a correct dual API usage.
- `Match.orElse` as a catch-all when the input type is open-ended (e.g., `string | number | boolean`) — exhaustiveness is not always possible.
- Short `Effect.gen` blocks (1-3 yields) that are clearly scoped — not all short blocks need conversion to pipe.
- `Brand.nominal` without refinement when only type distinction is needed — this is the correct use of nominal branding.
- Schema definitions using `Schema.Class` with methods — this is a valid pattern when prototype methods are needed.
- `pipe` chains with up to 3 chained calls for simple transformations — this is the sweet spot for pipe readability.
- Using `flow` from `effect/Function` in pure type-level compositions that do not involve Effect runtime operations.
- Using `Console.log` inside development/debug code — but flag it for removal before production.

# Related Guides (from effect-ts skill references/)
- `../effect-ts/references/guide-effect.md` — Core `Effect` usage, constructors, composition, provisioning, runtime boundaries
- `../effect-ts/references/guide-layers.md` — Services, layer construction, composition, provisioning patterns
- `../effect-ts/references/guide-observability.md` — `Effect.fn`, spans, logging, metrics, telemetry wiring

Official documentation references:
- https://effect.website/docs/code-style/pattern-matching/ — Pattern matching with `Match` module
- https://effect.website/docs/code-style/guidelines/ — General code style guidelines (runMain, avoid tacit)
- https://effect.website/docs/code-style/dual/ — Dual API data-first / data-last patterns
- https://effect.website/docs/code-style/branded-types/ — Branded types with `Brand.nominal` and `Brand.refined`
- https://effect.website/docs/code-style/do/ — Excessive nesting solutions (Effect.Do / Effect.gen)

# Delegation
- Delegate to `effect-ts` for research strategy, installation guidelines, and in-depth guidance across all Effect domains.
- Delegate to `effect-ts-anti-patterns` for automated detection of Promise-first code, hidden dependencies, and oversized `Effect.gen` blocks.
- Delegate to `effect-ts-principle-thinking` for architectural mental model violations (mid-flight execution, orphaned fibers, wall-clock time, global state).
- Delegate to `effect-ts-error-handling` for typed error boundary design, `Schema.TaggedError` usage, and domain error flow patterns.
- Delegate to `effect-ts-resource-layer` for `Layer` construction, `Scope` management, and `acquireRelease` lifecycle patterns.

# Guardrails
- Focus on stylistic and structural correctness. Do not suggest changes that alter business logic or runtime behavior.
- When recommending `Match.exhaustive`, verify the union type is truly closed. If it comes from an external API or plugin system, `Match.orElse` is correct.
- Do not force `Effect.gen` over `pipe` when the existing code is already clear and type-safe. Style preferences are secondary to correctness.
- Always validate that naming convention suggestions match existing project conventions. If the project has established its own style, defer to it unless it conflicts with official Effect recommendations.
- When pointing out tacit usage, demonstrate the type inference failure with a concrete example rather than citing the rule abstractly.
- Never suggest refactoring a working `switch` to `Match.tag` if the switch is already type-exhaustive and the codebase has no other pattern matching usage — consistency is only valuable when the team has adopted the pattern.
