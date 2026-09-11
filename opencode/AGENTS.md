# Agent Instructions

Config root: `~/.config/opencode/`; this repo's `opencode/` mirrors it. Reference scripts/skills via `~/.config/opencode/{scripts,skills}/...`; scripts load GLOBAL-FIRST (never `./scripts` or CWD-relative).
Orchestration uses the `mas` skill; for multi-file work, load `~/.config/opencode/skills/mas/SKILL.md`.
The shell cwd is the session workspace, so run global scripts by ABSOLUTE path `node ~/.config/opencode/scripts/<name>.mjs` (never `scripts/...` or `./scripts/...`); this needs `shell` + `external_directory` access, not Code Mode `execute`.
CRITICAL: Respect repository rules. Every repo defines agent rules via AGENTS.md and markdown files in its root. Read them as priority instructions. Never skip or override the instruction author.
