---
name: effect-ts-schema
description: Type-safe data contracts, validation boundaries, serialization via @effect/schema. Concern-specific add-on.
---

## Fundamentals

`Schema<A, I, R>` — immutable blueprint:
- `A`: decoded output type
- `I`: wire format input type
- `R`: contextual dependencies (default `never`)

Key compilers: `decodeUnknownEffect`, `decodeEffect`, `encode`, `asserts`, `makeArbitrary`, `makeJsonSchema`, `makeEquivalence`.

## Rules

| Rule | Principle |
|---|---|
| Single source of truth | Define `Schema.Struct` once. Derive type via `Schema.Type<typeof S>`. Never manual duplicates. |
| Validate at boundaries | `Schema.decodeUnknownEffect(schema)(input)` at API/event edges. Trust type inside. |
| Rule of Schemas | `encode(decode(x)) === x`. Transforms must be reversible. |
| I ≠ A distinction | Separate wire format from domain type explicitly at serialization boundaries. |
| Filters narrow; transforms reshape | `filter` = narrow values. `transform` = change shape. `brand` = type proof. |
| Module-level consts | Schema values at module scope, not hot paths. |

## Preferred Patterns

- Basic: `Schema.Struct({ name: Schema.String, age: Schema.Number })`
- Type: `type User = Schema.Type<typeof UserSchema>`
- Parsing: `Schema.decodeUnknownEffect(UserSchema)(rawInput)`
- Domain errors: `class X extends Schema.TaggedErrorClass<X>()("X", { id: Schema.String }) {}`
- Date: `Schema.Date` (string ↔ Date at JSON boundaries)
- Filters: `Schema.String.pipe(Schema.minLength(1), Schema.maxLength(255))`
- Unions: `Schema.Union(Circle, Square)` via `_tag` literals
- Projections: `Schema.pick("name", "email")` / `Schema.omit("passwordHash")`
- Testing: `Arbitrary.make(UserSchema)` for `fast-check`

## Anti-Patterns

| Pattern | Severity |
|---|---|
| Schema + manual type duplication | HIGH |
| `as` casts after parsing instead of inferred Type | HIGH |
| Untrusted data past boundaries (unknown/any in domain) | HIGH |
| Silent data loss in transform (encode drops fields) | HIGH |
| Schema instances in request handlers/loops (hot path) | MEDIUM |
| `filter` used for reshaping instead of `transform`/`brand` | MEDIUM |
| Manual validation alongside Schema | LOW |

## Guardrails

- Never remove boundary validation — core security model.
- Verify encode+decode round-trip for transformations.
- Use `decodeUnknownEffect` for untrusted input, never `decodeSync`.
- Duplicate types → replace interface with `Schema.Type<typeof schema>`.
