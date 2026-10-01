# Anti-slop

Rules that keep agent output small and structural. Notice them, then enforce them.

## Why

Agent code trends verbose and structurally eroded. Explicit scope and mechanical gates beat prompt advice. Prompt advice helps only the start, so state the evidence direction and stop guessing. Do not cite vendor decimals or invented metrics.

## Scope contract

Every lane declares AUTHORIZED_SCOPE: the files it may touch and what each change may do. Work outside that scope requires ask-to-continue. Never widen scope silently, and never edit a file outside TARGET_FILES.

## Diff budget

A lane's diff has a budget of about 400 changed lines. Exceeding the budget requires a stated justification or the gate blocks the lane.

## Cleanup pass

Delete in this order: dead code, then placeholders, then dev and test scaffolding, then real duplication, then comment hygiene. Run one pass before review. Do not mix cleanup into feature work.

## Comment policy

Default to no comment. Comment only to carry why, never what. Never narrate the code or the change. A one-line summary on a public entry point is allowed.

## Mechanical gate

Run the analyzers per stack, and block on them:

- JS/TS: `knip` for dead code, unused exports and unused deps. ESLint budgets: `complexity <= 10`, `max-lines-per-function <= 50`, `max-depth <= 4`, `max-params <= 3`, `ban-ts-comment`. Then `jscpd --threshold 5 --fail-on-new-clones`.
- Python: `vulture --min-confidence 80` and `ruff F401/F811`.
- Go: `staticcheck U1000` and golangci-lint `unused`.

False-positive caveats: entry points, plugins and dynamic imports stay reachable without a static reference. Review each hit, then fix or suppress it in the config, never inline.

## Fresh-context cleanup

The tester performs the cleanup check in a fresh context. Do not add a new agent for it.

## Do not adopt

`ts-prune`, `unimported`, `bors-ng`, `plato` are unmaintained or superseded.
