---
name: effect-ts-schema
description: Type-safe data contracts, validation boundaries, serialization using @effect/schema. Schema-first design — define once, derive types, JSON Schema, and test arbitraries.
---

## Schema Fundamentals

`Schema<A, I, R>` — immutable value describing data structure:
- `A` (Type): decoded/validated output type
- `I` (Encoded): wire format / input type
- `R` (Requirements): contextual dependencies (default `never`)

Schema values are immutable blueprints, interpreted by compilers:
- **decodeUnknownEffect** — parse unknown → typed output (Effect-based, boundary validation)
- **decodeEffect** — decode from known Encoded type
- **encode** — convert Type → Encoded for serialization
- **asserts** — runtime assertion that value matches schema
- **makeArbitrary** — generate `fast-check` arbitraries for property testing
- **makeJsonSchema** — produce JSON Schema from schema definition
- **makeEquivalence** — produce deep equality checker
- **Standard Schema V1** — `Schema.toStandardSchema(S)` for cross-platform consumption

## Rules

| Rule | Principle |
|---|---|
| Schema as single source of truth | Define `Schema.Struct` once. Derive type: `Schema.Type<typeof S>`. Never duplicate. |
| Validate at boundaries | `Schema.decodeUnknownEffect(schema)(input)` at API/event edges. Trust type inside. |
| Rule of Schemas | `encode(decode(x)) === x`. Transformations must be reversible. |
| I ≠ A distinction | `I` = wire format. `A` = domain type. Separate explicitly for serialization boundaries. |
| Filters narrow; transforms reshape | `Schema.filter` — narrows allowed values only. `Schema.transform` / `transformOrFail` — changes shape. `Schema.brand` — carries proof in type. |
| Errors are structured | `ParseResult.TreeFormatter` for canonical debugging. `ParseResult.ArrayFormatter` for structured field-level errors consumed by form libraries. |
| Module-level consts | Schema values at module scope, not inside request handlers or hot paths. |
| `exactOptionalPropertyTypes` | Enable in tsconfig. Without it, optional props widen to `string | undefined`. |

## Preferred Patterns

- **Basic Structs:** `Schema.Struct({ name: Schema.String, age: Schema.Number })`
- **Type Derivation:** `type User = Schema.Type<typeof UserSchema>`
- **Boundary Parsing:** `Schema.decodeUnknownEffect(UserSchema)(rawInput)` at handlers
- **Domain Errors:** `class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()("NotFoundError", { id: Schema.String }) {}`
- **Transformations:** `Schema.Date` (decodes from string, encodes to string) at JSON boundaries
- **Filters:** `Schema.String.pipe(Schema.minLength(1), Schema.maxLength(255))`
- **Discriminated Unions:** `Schema.Union(Circle, Square)` using `_tag` literals
- **Annotations:** `Schema.annotations({ identifier: "UserId", description: "...", jsonSchema: { minLength: 1 } })`
- **Projections:** `UserSchema.pipe(Schema.pick("name", "email"))` or `Schema.omit("passwordHash")`
- **Testing:** `Arbitrary.make(UserSchema)` → `fast-check` arbitraries

## Anti-patterns

| Pattern | Detect | Severity |
|---|---|---|
| Schema + manual type duplication | `interface User` + separate `Schema.Struct` for User | HIGH |
| `as` casts after parsing | Using `as User` instead of inferring from schema's `Type` | HIGH |
| Untrusted data past boundaries | `unknown`/`any` flowing through domain logic | HIGH |
| Silent data loss in transform | `encode` drops fields or `decode` fabricates defaults | HIGH |
| Schema in hot paths | New Schema instances in request handlers or loops | MEDIUM |
| `Schema.filter` to change shape | Using filter for reshaping when transform/brand needed | MEDIUM |
| Manual validation alongside Schema | `if (typeof x !== "string")` next to Schema definition | LOW |
| Over-transformation chains | Multiple `Schema.transform` when single `transformOrFail` works | LOW |

## Severity

| Level | Criteria |
|---|---|
| HIGH | Untrusted data past boundaries, drifted duplicate types, encode data loss, API that won't compile |
| MEDIUM | Missing annotations, over-nested transforms, filter-where-brand-needed |
| LOW | Suboptimal projections, inline schemas, redundant annotations |

## Output per finding
- File:line location
- Schema issue
- Schema-first replacement pattern with code example
- Risk level

## Guardrails
- Never remove schema validation at boundaries — this is the core security model.
- Verify encode+decode round-trips when suggesting transformations.
- Use `Schema.decodeUnknownEffect` for untrusted input, never `decodeSync`.
- Duplicate types → replace interface with `Schema.Type<typeof schema>`, never the reverse.
- Beta APIs shift between releases — verify existence in `packages/effect/src/*.ts`.
