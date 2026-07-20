#!/usr/bin/env bash
# nyx bootstrap -- install agent skills, tools, env vars, and cache directories.
# Usage: ./bootstrap.sh install
set -euo pipefail

DOTFILES="$(cd "$(dirname "$0")" && pwd)"

# -- Path configuration --
AGENTS_DIR="$HOME/.agents"
CDP_DIR="$AGENTS_DIR/skills/cdp"
GSEARCH_DIR="$AGENTS_DIR/skills/gsearch"
BIN_DIR="$HOME/.local/bin"
CACHE_DIR="/tmp/nyx-search-cache"
TEMP_PROFILE_DIR="/tmp/gsearch-profile"

# Source paths (nyx repo -- single source of truth)
SRC_CDP="$DOTFILES/agents/skills/cdp"
SRC_GSEARCH="$DOTFILES/agents/skills/gsearch"

# Track verification failures
FAILED=0

# -- Helper functions --

symlink_file() {
  local src="$1" dest="$2"
  mkdir -p "$(dirname "$dest")"
  if [ -L "$dest" ] || [ -e "$dest" ]; then
    rm -rf "$dest"
  fi
  ln -sf "$src" "$dest"
}

symlink_glob() {
  local src_base="$1" dest_base="$2" pattern="$3"
  local src_path="$src_base/$pattern"
  for f in $src_path; do
    [ -f "$f" ] || continue
    local rel="${f#$src_base/}"
    symlink_file "$f" "$dest_base/$rel"
  done
}

verify_symlink() {
  local path="$1" label="$2"
  if [ -L "$path" ] && [ -e "$path" ]; then
    :
  else
    printf '  [FAIL] %s - %s missing or broken\n' "$label" "$path"
    FAILED=1
  fi
}

verify_dir() {
  local path="$1" label="$2"
  if [ -d "$path" ]; then
    :
  else
    printf '  [FAIL] %s - %s not found\n' "$label" "$path"
    FAILED=1
  fi
}

# -- Dependency checks --

check_deps() {
  if ! command -v bun &>/dev/null; then
    echo "  [INFO] Bun not found. Install: curl -fsSL https://bun.sh/install | bash"
    return 1
  fi
  printf '  [OK] bun: found\n'
}

# -- Environment setup (profile injection) --

ensure_path() {
  if ! echo ":$PATH:" | grep -q ":$BIN_DIR:"; then
    local profile=""
    for f in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.profile"; do
      [ -f "$f" ] && { profile="$f"; break; }
    done
    if [ -n "$profile" ] && ! grep -q '\.local/bin' "$profile" 2>/dev/null; then
      printf '\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$profile"
      printf '  [OK] Added %s to PATH in %s\n' "$BIN_DIR" "$profile"
    fi
    export PATH="$BIN_DIR:$PATH"
  fi
}

ensure_env_var() {
  local var="$1" value="$2" profile=""
  for f in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.profile"; do
    [ -f "$f" ] && { profile="$f"; break; }
  done
  [ -z "$profile" ] && return 0
  if ! grep -q "export $var=" "$profile" 2>/dev/null; then
    printf 'export %s="%s"\n' "$var" "$value" >> "$profile"
    printf '  [OK] Set %s=%s in %s\n' "$var" "$value" "$profile"
  fi
}

# -- Install logic --

install() {
  # -- Dependencies --
  check_deps || {
    echo "  [INFO] Install missing dependencies and re-run."
    exit 1
  }

  local opencode_target="$HOME/.config/opencode"
  mkdir -p "$opencode_target"
  rsync -av --delete \
    --exclude='node_modules/' \
    --exclude='.git/' \
    --exclude='.DS_Store' \
    --exclude='skills-lock.json' \
    --exclude='sync-*.sh' \
    "$DOTFILES/opencode/" "$opencode_target/"

  rm -rf "$CDP_DIR" "$GSEARCH_DIR"

  for file in browser-automation.ts templates.ts cache.ts quality.ts; do
    symlink_file "$SRC_CDP/scripts/$file" "$CDP_DIR/scripts/$file"
  done

  for file in session.ts repl.ts generated.ts; do
    symlink_file "$SRC_CDP/sdk/$file" "$CDP_DIR/sdk/$file"
  done
  symlink_file "$SRC_CDP/sdk/browser-harness-js" "$CDP_DIR/sdk/browser-harness-js"

  symlink_file "$SRC_CDP/SKILL.md" "$CDP_DIR/SKILL.md"
  symlink_glob "$SRC_CDP" "$CDP_DIR" "interaction-skills/*.md"
  symlink_glob "$SRC_CDP" "$CDP_DIR" "reference/*.md"

  symlink_file "$SRC_GSEARCH/scripts/gsearch" "$GSEARCH_DIR/scripts/gsearch"
  symlink_file "$SRC_GSEARCH/scripts/pdf-extract.ts" "$GSEARCH_DIR/scripts/pdf-extract.ts"
  symlink_file "$SRC_GSEARCH/scripts/setup" "$GSEARCH_DIR/scripts/setup"
  symlink_glob "$SRC_GSEARCH" "$GSEARCH_DIR" "lib/*.sh"

  symlink_file "$SRC_GSEARCH/SKILL.md" "$GSEARCH_DIR/SKILL.md"
  symlink_glob "$SRC_GSEARCH" "$GSEARCH_DIR" "reference/*.md"

  mkdir -p "$BIN_DIR"
  symlink_file "$CDP_DIR/sdk/browser-harness-js" "$BIN_DIR/browser-harness-js"
  symlink_file "$GSEARCH_DIR/scripts/gsearch" "$BIN_DIR/gsearch"

  ensure_path

  ensure_env_var "CDP_SCRIPTS" "$CDP_DIR/scripts"
  ensure_env_var "GSEARCH_SCRIPTS" "$GSEARCH_DIR/scripts"
  ensure_env_var "CDP_SDK" "$CDP_DIR/sdk"
  export CDP_SCRIPTS="$CDP_DIR/scripts"
  export GSEARCH_SCRIPTS="$GSEARCH_DIR/scripts"
  export CDP_SDK="$CDP_DIR/sdk"

  mkdir -p "$CACHE_DIR"
  mkdir -p "$TEMP_PROFILE_DIR"


  verify_symlink "$CDP_DIR/scripts/browser-automation.ts" "CDP: browser-automation.ts"
  verify_symlink "$CDP_DIR/scripts/templates.ts"          "CDP: templates.ts"
  verify_symlink "$CDP_DIR/scripts/cache.ts"              "CDP: cache.ts"
  verify_symlink "$CDP_DIR/scripts/quality.ts"            "CDP: quality.ts"

  verify_symlink "$CDP_DIR/sdk/session.ts"          "CDP SDK: session.ts"
  verify_symlink "$CDP_DIR/sdk/repl.ts"             "CDP SDK: repl.ts"
  verify_symlink "$CDP_DIR/sdk/generated.ts"        "CDP SDK: generated.ts"
  verify_symlink "$CDP_DIR/sdk/browser-harness-js"  "CDP SDK: browser-harness-js"

  verify_symlink "$CDP_DIR/SKILL.md" "CDP: SKILL.md"

  verify_symlink "$GSEARCH_DIR/scripts/gsearch"        "gsearch: CLI"
  verify_symlink "$GSEARCH_DIR/scripts/pdf-extract.ts" "gsearch: pdf-extract.ts"
  verify_symlink "$GSEARCH_DIR/scripts/setup"          "gsearch: setup"
  verify_symlink "$GSEARCH_DIR/SKILL.md"               "gsearch: SKILL.md"

  verify_symlink "$GSEARCH_DIR/lib/common.sh" "gsearch lib: common.sh"
  verify_symlink "$GSEARCH_DIR/lib/search.sh" "gsearch lib: search.sh"

  verify_symlink "$BIN_DIR/gsearch"             "PATH: gsearch"
  verify_symlink "$BIN_DIR/browser-harness-js"  "PATH: browser-harness-js"

  verify_dir "$CACHE_DIR"       "Cache: $CACHE_DIR"
  verify_dir "$TEMP_PROFILE_DIR" "Temp profile: $TEMP_PROFILE_DIR"

  echo ""
  if [ "$FAILED" -eq 0 ]; then
    echo "  [OK] All checks passed"
  else
    echo "  [FAIL] Some checks failed"
    exit 1
  fi

  echo ""
  echo "  opencode config:  ~/.config/opencode/"
  echo "  agent skills:     ~/.agents/"
  echo "    cdp/scripts     browser-automation.ts, templates.ts, cache.ts, quality.ts"
  echo "    cdp/sdk         session.ts, repl.ts, generated.ts, browser-harness-js"
  echo "    gsearch/scripts gsearch CLI, pdf-extract.ts, setup"
  echo "    gsearch/lib     common.sh, search.sh, batch.sh, actions.sh, follow.sh, pdf.sh"
  echo "  CLI tools:        ~/.local/bin/{gsearch,browser-harness-js}"
  echo "  env:              CDP_SCRIPTS, GSEARCH_SCRIPTS, CDP_SDK"
  echo "  cache:            /tmp/nyx-search-cache"
  echo "  temp profile:     /tmp/gsearch-profile"
  echo ""
  echo "  Requires: Google Chrome or Dia installed for browser automation."
  echo ""
  echo "  Quick start:"
  echo "    gsearch launch"
  echo "    gsearch --count 2 \"your topic\""
  echo ""
  echo "  To reinstall: $0 install"
  echo "  Repo: https://github.com/datnguyennnx/nyx"
}

# -- CLI dispatch --

case "${1:-}" in
  install|--install|-i) install ;;
  *)
    echo "Usage: $(basename "$0") <command>"
    echo "  install  First-time setup: symlink skills, link CLI tools,"
    echo "           create cache dirs, set env vars."
    ;;
esac

# NOTE: One-direction sync only
#
# This repo (nyx) is the SINGLE SOURCE OF TRUTH.
# All sync is one direction: repo -> global (~/.config/opencode, ~/.agents).
#
# To apply changes:  ./bootstrap.sh install
#
# NEVER sync from global back to repo. If you modified files in
# ~/.config/opencode or ~/.agents, copy them manually to this repo.
