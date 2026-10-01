# Worktrees

A worktree gives one lane an isolated working tree. Use it to keep concurrent writers apart.

## When to use

Create a worktree when all three hold:

- the lanes are independent,
- their write-sets are file-disjoint,
- a lane needs isolation from concurrent edits.

Check the write-sets before you create one. A same file in two lanes means sequence, not isolate.

## When NOT to use

Runtime is NOT isolated. Ports, databases, caches, and fixtures stay shared across worktrees.

- Never parallelize dependent interfaces. Sequence them.
- A worktree isolates the working tree only. It isolates nothing the process touches at run time.

If two lanes need the same port or database, serialize them.

## Native first

OpenCode V2 ships worktrees. Use these before raw git:

- Config key `worktree.directory`: set the worktree container.
- Plugin calls `ctx.worktree.create`, `ctx.worktree.list`, `ctx.worktree.refresh`, `ctx.worktree.remove`.
- Event `worktree.updated`: react to worktree changes.
- `session_move`: move the session; it takes effect at a safe boundary.

The API and its signatures are unstable. Prefer config plus native operations, and treat hardcoded endpoints as fragile. Raw `git worktree` is the fallback.

## Lifecycle

Follow this order:

1. Gitignore the worktree container FIRST.
2. Create from `origin/main` on a branch named `<kind>/<id>-<slug>` (for example `feat/X-3-antislop-gate`) per Naming and traceability.
3. Bootstrap dependencies and `.env`; untracked files are not carried.
4. Require a GREEN baseline test before you spawn.
5. Lock the worktree while the lane runs.
6. Remove, then prune, after merge.

Status output stays terse: `path branch state`. Never narrate git operations. Clarity wins for anything irreversible or destructive; spell those out in full.

## Scheduler

Kahn levels are the frontier. Inside one level, order by critical path, heaviest first (longest processing time).

Gate concurrency with a hard semaphore on worktree slots. Slots are the scarce resource, not CPU count.

## Conflict graph

Build a graph from each lane write-set:

- add an edge on a shared write,
- add an edge on a write paired with a read.

Compute connected components. Parallelize ONLY across components. When one component must fan out, assign bipartite (Hungarian or Hopcroft-Karp) or partition k-way (METIS).

## Merge-back

Serialize through a merge queue: one branch at a time onto current trunk.

- Bisect on failure.
- Keep batches small, or size-1 when the gate failure rate is high.
- Enable `git rerere`.
- Use `git merge-tree --write-tree` as a cheap pre-flight.
- Never octopus merge.

## Best-of-K

Use best-of-K only for high-uncertainty tasks. The tester is the verifier. Select by a rubric or a tournament, not full pairwise.

## Rollback

Discarding the branch is the rollback primitive; it is cheap. Retry under a per-lane cap, then re-insert the lane into the frontier. Reserve compensation for effects that escaped the worktree.

## Naming and traceability

A worktree is how the orchestrator structures its own work and code changes so they stay traceable. One lane equals one branch equals one worktree; never run two lanes on one branch.

- Branch name: `<kind>/<id>-<slug>`. `kind` is one of `feat`, `fix`, `chore`, `docs`, `test`. `id` is the lane id, for example `X-3` or `S-W6`. `slug` is at most five kebab words. Example: `feat/X-3-antislop-gate`.
- Follow-up fix to the same lane after a gate failure appends `-changes` (or `-r2`) to the same branch stem: `feat/X-3-antislop-gate-changes`.
- Worktree path carries the Kahn level: `.worktrees/l<level>/<kind>-<id>-<slug>`.
- Traceability chain: worktree path to branch to lane id to ledger entry to gate evidence (`S-N -> file:line`) to commit. Any change must be traceable back to one lane id.
- `git worktree list` is the live board of work in flight. Merge follows Kahn level order through the serial merge queue.
- Discard removes the worktree and deletes the branch. Draft work uses a `draft/` prefix and is never merged.
