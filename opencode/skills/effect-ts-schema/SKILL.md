---
name: effect-ts-schema
description: Define type-safe data contracts, validation boundaries, and serialization using @effect/schema. Model domain types with Schema, apply filters, transformations, and derive JSON Schema / Arbitraries for testing.
---

# Companion Skill
Load `effect-ts` alongside this skill for research strategy, installation guidelines, and access to detailed reference guides (`../effect-ts/references/guide-schema.md`). The main `effect-ts` skill provides the canonical research methodology: local guides first → codebase patterns → Effect source code. This skill is the exclusive source of truth for schema design patterns; the main skill provides the general-purpose research framework and installation guidance.

# Purpose
This skill ensures Effect-TS code uses `@effect/schema` to define precise, type-safe data contracts. It guides schema design for validation at system boundaries, type-safe serialization/deserialization, and integration with domain error types. A well-designed schema is a **single source of truth** that derives TypeScript types, JSON Schema, fast-check arbitraries, and equivalence checks from one immutable definition.

# Use when
Defining or reviewing code that needs:
- Data validation at API boundaries (request/response parsing, form validation)
- Type-safe encoding/decoding between wire formats and domain types
- Domain error modeling with `Schema.TaggedErrorClass`
- Deriving types, JSON Schema, or test data generators from a single schema definition
- Replacing inline `as` casts, manual type guards, or imperative validation logic
- Integrating with external systems (message queues, event buses, third-party APIs)
- Sharing contracts between services with Standard Schema V1

# Inputs
- Effect-TS source files importing from `effect/Schema`
- API route handlers, event handlers, and message consumers
- Error type definitions and domain model types
- Existing validation logic (type guards, `as` casts, runtime checks)
- Configuration schemas and environment variable parsers
- Inter-service contract definitions

# Core principles
- **Schema as Contract:** A `Schema<A, I, R>` is an immutable value describing the structure of data. It is a blueprint, not an execution — interpreted by "compilers" (decode, encode, assert, JSON Schema, arbitrary, equivalence, pretty-print).
- **Single Source of Truth:** Define the schema once. Derive the TypeScript type from it via `Schema.Type<>`. Never duplicate type definitions — let the schema own the shape.
- **Validation at Boundaries:** Parse untrusted data at the edge of your system using `Schema.decodeUnknown`. Once inside, trust the type. Never spread `unknown` through domain logic.
- **The Rule of Schemas:** Encoding then decoding must return the original value. `encode(decode(x)) === x`. Design transformations that are reversible.
- **Encoding is a Mirror:** The `I` (Encoded) type parameter represents what goes over the wire. The `A` (Type) parameter represents the domain model. Separate them explicitly for serialization boundaries (e.g., `Schema<Date, string>` at an API layer).
- **Filters are Protective, Not Destructive:** `Schema.filter` narrows the allowed values without changing the `Type`. Use `Schema.brand` or transformations when you need the `Type` to carry proof of validation.
- **Errors are Structured, Not Strings:** Schema validation produces `ParseError` trees with paths, issues, and messages. Use `ParseResult.TreeFormatter` for canonical human-readable debugging output and `ParseResult.ArrayFormatter` for structured field-level error objects consumed by form libraries.

# Preferred patterns
- **Basic Structs:** `Schema.Struct({ name: Schema.String, age: Schema.Number })` — the building block of most schemas.
- **Schema-Driven Domain Types:** Derive types from schemas: `type User = Schema.Type<typeof UserSchema>`. Never write the type by hand.
- **Boundary Parsing:** `Schema.decodeUnknown(UserSchema)(rawInput)` at API handlers — validate unknown input, get typed output or structured error.
- **Domain Error Modeling:** `class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()("NotFoundError", { id: Schema.String }) {}` — tagged errors with schema-validation for the error payload.
- **Transformations for Serialization:** `Schema.Date` (decodes from string, encodes to string) at JSON boundaries, keeping `Date` objects in domain code.
- **Filters for Constraints:** `Schema.String.pipe(Schema.minLength(1), Schema.maxLength(255))` — compose filters via `pipe`.
- **Discriminated Unions for Polymorphism:** `Schema.Union(Circle, Square)` using `_tag` literals — schema-level exhaustive pattern matching.
- **Annotations for Documentation:** `Schema.annotations({ identifier: "UserId", description: "...", jsonSchema: { minLength: 1 } })` — metadata flows to JSON Schema and documentation.
- **Standard Schema V1 Output:** `Schema.toStandardSchema(UserSchema)` — produce a portable schema contract for cross-platform consumption (Zod, Valibot, etc.).
- **Arbitraries for Testing:** `Arbitrary.make(UserSchema)` generates `fast-check` arbitraries for property-based testing.
- **Equivalence:** `Equivalence.make(UserSchema)` produces `Equivalence<User>` for deep-value comparison without hand-written `equals`.
- **Projections:** `UserSchema.pipe(Schema.pick("name", "email"))` or `Schema.omit("passwordHash")` — derive subset/superset schemas without duplication.

# Anti-patterns
- **Schema Duplication:** Defining a TypeScript `interface` and then separately writing a `Schema.Struct` that mirrors it. The schema IS the type. Derive it.
- **Raw `as` Casts After Parsing:** Using `Schema.decodeUnknown` but then casting the result with `as User` instead of inferring the type from the schema's `Type`.
- **Untrusted Data Past Boundaries:** Passing `unknown` or `any` through domain services. Validate once at the boundary, then use the typed value.
- **Schema in Hot Paths Without Memoization:** Creating new Schema instances inside request handlers or effect loops. Schema values should be module-level constants.
- **Over-Transformation:** Chaining multiple `Schema.transform` calls when a single `Schema.transformOrFail` with proper Effect-based logic would be clearer and safer.
- **Silent Data Loss in Transformations:** Writing `encode` transformations that drop fields or `decode` transformations that fabricate defaults without explicit annotations — breaks the Rule of Schemas (encode + decode ≠ original).
- **Using `Schema.filter` to Change Shape:** Filters must not alter the value. If you need to reshape, use `Schema.transform`. If you need proof of validation in the type, use `Schema.brand`.
- **Raw Validation Logic:** Writing manual `if (typeof x !== "string")` guards alongside Schema definitions. The schema itself is the validator — use `Schema.decodeUnknown` or `Schema.is(Schema)`.

# Workflow
1. **Locate Boundaries:** Find all points where data enters the system (API handlers, event consumers, message queues, config loading, CLI args).
2. **Check for Unsafe Input Handling:** Look for `unknown`, `any`, `as` casts, manual type guards, or `JSON.parse` without validation.
3. **Audit Type Duplication:** Scan for TypeScript interfaces/types that mirror data structures already described by schemas — consolidate into schema-first.
4. **Verify Encode/Decode Symmetry:** For schemas with different `A` and `I` types, verify that `encode(decode(x)) === x` holds.
5. **Review Error Handling:** Ensure `ParseError` trees are properly formatted with `ParseResult.TreeFormatter` (canonical debugging) or `ParseResult.ArrayFormatter` (structured field-level errors for form libraries). Never expose raw ParseError to callers.
6. **Check Schema Composition:** Look for duplicate struct definitions that could be factored into shared base schemas via `pick`, `omit`, `extend`, or `partial`.
7. **Validate Annotations:** Ensure schemas carry `identifier`, `description`, and `jsonSchema` annotations where applicable for downstream tooling.
8. **Document & Refactor:** For any anti-pattern discovery, explain *why* schema-first is safer and provide the single-schema pattern as replacement.

# Output contract
Return findings with:
- File location and line numbers
- Specific schema issue (from anti-patterns list above)
- Explanation of why it violates Effect-TS schema principles (type safety gap, boundary leak, duplication)
- Recommended schema-first pattern with code example
- Risk level (low/medium/high)
- Verification notes for any schema behavior claims

# Severity Criteria
- **HIGH:** Untrusted data flowing past boundaries without validation (`unknown` in domain logic); Schema duplication between `interface` and `Schema.Struct` that have drifted (silent bugs); `encode` that drops fields breaking the Rule of Schemas — will cause production data corruption.
- **MEDIUM:** Missing annotations (identifier, description) on public-facing schemas; over-nested transformations that reduce readability; `Schema.filter` used where `Schema.brand` would provide stronger type proof.
- **LOW:** Suboptimal projection patterns (manual pick/omit vs schema composition); schemas defined inside functions instead of module scope; redundant annotations.

# Acceptable Patterns (do NOT flag)
These patterns are correct usage — do not flag them as anti-patterns:
- `Schema.Struct`, `Schema.Union`, `Schema.Literal`, `Schema.TemplateLiteral` for defining data shapes — this IS the canonical way to build schemas.
- `Schema.decodeUnknown(schema)(input)` at API/event boundaries — this IS proper boundary validation.
- `Schema.Type<typeof schema>` for type derivation — this IS the correct type inference pattern.
- `Schema.transform` / `Schema.transformOrFail` for encoding/decoding between wire and domain formats — this IS proper transformation.
- `Schema.filter` for validation constraints (minLength, maxLength, pattern, int, positive, etc.) — this IS the purpose of filters.
- `Schema.TaggedErrorClass` for domain errors with schema-validated payloads — this IS the modern typed error pattern.
- `Schema.annotations` with identifier, description, jsonSchema, title, examples — this IS proper documentation.
- `Arbitrary.make(schema)` for test data generation — this IS correct testing practice.
- Schema composition via `pipe(Schema.pick(...))`, `pipe(Schema.omit(...))`, `Schema.partial`, `Schema.required` — this IS DRY schema design.
- Schema values defined as module-level `const` declarations — this IS correct placement outside hot paths.
- Using `Schema.is(Schema)(data)` for type-narrowing conditionals at untyped boundaries — this IS correct quick-check pattern.
- `Schema.decodeUnknownEither(schema)` for non-throwing validation with `Either` — this IS correct functional error handling.
- Manual type annotations for external API responses where schema generation from OpenAPI/GraphQL schemas is used alongside — this IS pragmatic when schemas are auto-generated.

# Related Guides (from effect-ts skill references/)
- `../effect-ts/references/guide-schema.md` — Schema design patterns, tagged errors, Class APIs, Standard Schema V1

# Delegation
Delegate to:
- **effect-ts** for research strategy, installation guidelines, and in-depth guidance across all Effect domains.
- effect-ts-principle-thinking for Programs as Values violations (schemas defined inside hot paths, mutable schema state).
- effect-ts-error-handling for error modeling with `Schema.TaggedErrorClass` and boundary mapping patterns.
- effect-ts-resource-layer for schemas that require Context-dependencies in transformations (`Schema.transformEffect` / `Schema.filterEffect`).
- effect-ts-anti-patterns for Promise-first code leaking into schema validation paths.

# Guardrails
- Never suggest removing schema validation at boundaries — this is the core security model.
- Preserve the Rule of Schemas when suggesting transformations — verify encode+decode round-trips.
- Avoid over-specifying annotations that don't have a clear consumer (JSON Schema, documentation, testing).
- Do not suggest replacing `Schema.TaggedErrorClass` with raw `Data.TaggedError` unless the codebase explicitly needs lightweight error types without schema validation.
- Prevent creating schemas that silently truncate or fabricate data — transformations must be explicit and documented.
- Do not suggest `Schema.decodeSync` for untrusted input — use `Schema.decodeUnknown` which explicitly validates from `unknown`.
- When schema duplication is found between `interface` and `Schema.Struct`, always recommend replacing the interface with `Schema.Type<typeof schema>`, never the reverse.
