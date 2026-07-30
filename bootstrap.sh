#!/usr/bin/env bash
# nyx bootstrap -- install agent skills, tools, env vars, and cache directories.
# Usage: ./bootstrap.sh install
set -euo pipefail

DOTFILES="$(cd "$(dirname "$0")" && pwd)"

# -- Path configuration --
AGENTS_DIR="$HOME/.agents"
BIN_DIR="$HOME/.local/bin"
CACHE_DIR="/tmp/nyx-search-cache"

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

# -- Install logic -- (opencode config, env vars, cache dirs)
# NOTE: gthings skill files are managed by `gthings update`, not by this script.

install() {
  local opencode_target="$HOME/.config/opencode"
  local agents_target="$HOME/.agents"

  mkdir -p "$opencode_target" "$agents_target"

  rsync -av --delete \
    --exclude='node_modules/' \
    --exclude='.git/' \
    --exclude='.DS_Store' \
    --exclude='skills-lock.json' \
    --exclude='sync-*.sh' \
    "$DOTFILES/opencode/" "$opencode_target/"

  rsync -av --delete \
    --exclude='.git/' \
    --exclude='.DS_Store' \
    "$DOTFILES/.agent/" "$agents_target/"

  ensure_path

  mkdir -p "$CACHE_DIR"

  verify_dir "$CACHE_DIR" "Cache: $CACHE_DIR"
  verify_dir "$opencode_target" "opencode config"
  verify_dir "$agents_target" "agent skills"

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
  echo ""
  echo "  Requires: gthings binary installed via 'cargo install gthings'"
  echo "            Browser (Chrome/Dia) running with --remote-debugging-port=9222"
  echo ""
  echo "  Quick start:"
  echo "    gthings update    # install skill files"
  echo "    gthings status"
  echo "    gthings search --count 2 \"your topic\""
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
