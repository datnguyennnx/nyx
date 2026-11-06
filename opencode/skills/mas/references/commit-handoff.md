# Commit handoff

A passed lane reaches the operator as a copy-pasteable block, never as a commit the orchestrator runs.

## Who commits

The operator runs every `git commit`. The orchestrator writes the block and stops. Two reasons: the pre-commit hook reads the operator's machine state, and HITL-5 makes acceptance the operator's call. `git add` and `git commit` are not in the shell deny list, so an agent could run them; it must not unless asked.

## When

Only after the Step 4 gate passed, Step 5 Sufficiency passed, and the Auto Report is written. Never as a way to save unverified work.

## The block

One fenced `bash` block. It opens with `cd <repo root>`, lists explicit paths, and ends with the commit.

```bash
cd ~/personal/0xsignal
git add packages/app/src/a.ts \
        packages/app/src/b.tsx
git commit -m "feat(scope): lowercase imperative summary"
```

- **Explicit paths only**: never `git add -A`, `git add .`, or a directory. The worktree routinely holds several uncommitted waves, and a blanket add captures another wave's half-finished work.
- **Deletions** need `git rm` or `git add -u <path>`. A plain path for a removed file fails.
- **One commit per concern.** Two concerns means two blocks, in order.

## Message

`type(scope): summary`, lowercase, no trailing period, under 72 characters.

| type | use |
|---|---|
| `feat` | new behaviour |
| `fix` | corrected behaviour |
| `refactor` | no behaviour change |
| `chore` | tooling, config, gates |

The summary names the user-visible change, not the file. `fix(whales): source the whale's chart lines from its own account` beats `update coin-price-dialog.tsx`.

## Splitting

What decides the split is not readability, it is whether each commit passes the hook on its own.

- **A new module lands with its first consumer.** `knip` fails on an export nothing imports, so a hook, the component that uses it, and the registry entry that mounts it are one commit.
- **A rename lands with its importers.** Split apart, one of the two commits does not compile.
- **Dependents follow.** If commit B imports something added in commit A, B comes second. Say so in the report; it is the one ordering a reader cannot infer.
- **A config or skill edit lands alone**, because the config validator is its gate.
- **Unclaimed edits get their own commit or are flagged.** A dirty file no wave claimed must be named and offered for discard. Never folded in silently.

State the split as a table before the commands:

| # | concern | why it cannot be smaller |
|---|---|---|

## What the block must state

- the repo root in the `cd`,
- every path that concern touched, and nothing else,
- the message,
- what stays uncommitted, with the count and the untracked files named, because `git clean` erases them,
- any dirty file that no wave owns.

## When the hook rejects the commit

Read the failing stage before changing anything.

- **`knip`**: a module has no consumer. Move it into the commit that consumes it. Never add an ignore.
- **`doctor --scope changed`**: it scans with `--include-untracked`, so the finding can name a file that is untracked and not staged. The split is still right, the finding is still real. Fix it, then re-run the same block.
- **format or lint**: fix the code. A rejected commit is a finding, not an obstacle.

`--no-verify` is banned by the no-bypass guard. It is not a fallback.

## Anti-patterns

- `git add -A`, for the reason above.
- One large commit “to keep the history simple”: five concerns behind one message, and `git bisect` stops being useful.
- A rename committed apart from its importers.
- Committing before the gate “so the work is safe”: an unverified commit is worse than a dirty tree, because it looks green.
- Running the commit for the operator without being asked.
