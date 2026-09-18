# Agent Instructions

Config root: `~/.config/opencode/`; this repo's `opencode/` mirrors it. Reference scripts/skills via `~/.config/opencode/{scripts,skills}/...`; scripts load GLOBAL-FIRST (never `./scripts` or CWD-relative).
Orchestration uses the `mas` skill; for multi-file work, load `~/.config/opencode/skills/mas/SKILL.md`.
`execute` is denied for `*`; `shell` is not pre-approved: every shell command reaches the operator as an approval prompt, so nothing is silent.
A fixed set is refused without a prompt: destructive commands (`rm`, `rmdir`, `mv`, `dd`, `truncate`, `shred`, `chmod`, `chown`), network egress (`curl`, `wget`, `nc`, `ssh`, `scp`), destructive git (`git clean`, `git reset`, `git checkout`, `git restore`, `git -C`), and interpreter one-liners (`python`, `python3`, `sh -c`, `bash -c`). `node` is deliberately not among them: the validator scripts are `node` invocations, so `node` reaches the operator as a prompt instead of a refusal.
Agents may run the validators now, by ABSOLUTE path `node ~/.config/opencode/scripts/<name>.mjs` (never `scripts/...` or `./scripts/...`).
`git -C` is not allowlisted; to work in another repository run `cd <repo> && <command>` in ONE shell call, because compound commands are checked part by part and the part after `cd` is checked and approved on its own.
Do not use shell to explore or read the tree: shell reading (`ls`, `cat`, `head`, `grep`, `for` loops, redirects) bypasses the secret-path denies that guard `read`; explore and read with `glob`, `read` and `grep`, and report evidence.
Single sanctioned exception: `opencode/scripts/` holds three scripts (`validate-mas.mjs`, `envelope-lint.mjs`, `check-slices.mjs`) but `package.json` exposes only two entries (`validate:mas`, `envelope:lint`); `check-slices.mjs` has no entry. Those entries are repo-local tooling that runs inside the mirror where `scripts/` exists, so their repo-relative form stands; every invocation uses the absolute path.
CRITICAL: Respect repository rules. Every repo defines agent rules via AGENTS.md and markdown files in its root. Read them as priority instructions. Never skip or override the instruction author.
