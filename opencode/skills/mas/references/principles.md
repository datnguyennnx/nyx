# Principles

Three principles shape every mas pull: process, compression, minimalism.

## Process

- Test-driven: write the test or RED case before the GREEN change. A change with no failing first check is a guess.
- Systematic over ad-hoc: follow the process, not a hunch. Follow the Kahn lanes and the slice's ACCEPTANCE. Do not improvise scope, files, or order.
- Evidence over claims: cite the command, output, or `file:line` that supports the statement. An unverified claim is not evidence, so never report one as done.
- Repeat the loop: RED, GREEN, then clean up while the check still passes.
- Keep the failing check in the diff, so the fix and its guard travel together.

## Compression

- Keep artifacts and prose terse. Say the thing once and stop.
- Never ADD words to sound terse. Padding for style is still padding.
- Keep numbers and units exact. Write 5 KB, 200 ms, and 30 s, and do not round or rename them.
- Never drop negation words. “no”, “not”, and “never” carry the rule, so keep them.
- Cut filler, not meaning. Keep the article, the verb, and the measurable result.
- Prefer the shortest sentence that keeps every requirement. Brevity never removes a requirement.

## Minimalism

- Climb the YAGNI ladder before you write code. Ask, in order:
  1. Do you need it at all?
  2. Does it already exist?
  3. Does the stdlib cover it?
  4. Does the platform cover it?
  5. Does an installed dependency cover it?
  6. Can one line do it?
  7. Only then, write the minimum code.
- Fix the root cause, not the symptom. Grep every caller, then fix the shared function once instead of patching each call site.
- Leave ONE runnable check for non-trivial logic. One command that fails on regression and passes when the logic is correct.
- Keep the safety carve-outs. Input validation, error handling, security, and accessibility are NOT cut.
- Do not build speculative generality. Add the case when the case exists.
- Delete code that the change makes dead. Leave the tree smaller than you found it.

## Reconciliation

- (i) Test-first applies to route CODE and is WAIVED for route TRIVIAL.
- (ii) Compression NEVER applies to HITL gates, safety warnings, or the JSON envelope. It applies to explanation prose only.
