#!/usr/bin/env bash
# Test: gsearch search.sh — cmd_search function behavior
set -euo pipefail

# --- Setup ---
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LIB="$SCRIPT_DIR/../lib"

# Source dependencies first, then search.sh
. "$LIB/common.sh"
. "$LIB/search.sh"

# --- Counters ---
pass=0
fail=0

# --- Assertion helpers ---

assert_eq() {
  local expected="$1" actual="$2" label="${3:-}"
  if [ "$actual" = "$expected" ]; then
    echo "  OK $label"
    pass=$((pass + 1))
  else
    echo "  FAIL FAIL: $label"
    echo "    expected: $expected"
    echo "    actual:   $actual"
    fail=$((fail + 1))
  fi
}

assert_contains() {
  local needle="$1" haystack="$2" label="${3:-}"
  if echo "$haystack" | grep -Fq -- "$needle"; then
    echo "  OK $label"
    pass=$((pass + 1))
  else
    echo "  FAIL FAIL: $label"
    echo "    expected to find: $needle"
    echo "    in: $haystack"
    fail=$((fail + 1))
  fi
}

assert_not_contains() {
  local needle="$1" haystack="$2" label="${3:-}"
  if echo "$haystack" | grep -Fq -- "$needle"; then
    echo "  FAIL FAIL: $label (found: $needle)"
    fail=$((fail + 1))
  else
    echo "  OK $label"
    pass=$((pass + 1))
  fi
}

assert_file_contains() {
  local needle="$1" file="$2" label="${3:-}"
  if grep -Fq -- "$needle" "$file"; then
    echo "  OK $label"
    pass=$((pass + 1))
  else
    echo "  FAIL FAIL: $label"
    echo "    expected to find in $file: $needle"
    fail=$((fail + 1))
  fi
}

# ════════════════════════════════════════════════════════════════════
# Test 1: Function definition exists
# ════════════════════════════════════════════════════════════════════

echo ""
echo "=== Test 1: Function definition ==="

if declare -F cmd_search >/dev/null 2>&1; then
  echo "  OK cmd_search function exists"
  pass=$((pass + 1))
else
  echo "  FAIL FAIL: cmd_search function not found"
  fail=$((fail + 1))
fi

# ════════════════════════════════════════════════════════════════════
# Test 2: No forbidden patterns in function body
# ════════════════════════════════════════════════════════════════════

echo ""
echo "=== Test 2: No forbidden patterns ==="

# Capture function body
FUNC_BODY=$(type cmd_search 2>/dev/null)

assert_not_contains "inject_connect" "$FUNC_BODY" "no inject_connect"
assert_not_contains "browser-harness-js" "$FUNC_BODY" "no browser-harness-js"
assert_not_contains "mktemp" "$FUNC_BODY" "no mktemp"
assert_not_contains "JSEOF" "$FUNC_BODY" "no JSEOF"
assert_not_contains "<<" "$FUNC_BODY" "no heredoc bodies"

# ════════════════════════════════════════════════════════════════════
# Test 3: Delegation to browser-automation.ts
# ════════════════════════════════════════════════════════════════════

echo ""
echo "=== Test 3: Delegation to browser-automation.ts ==="

SEARCH_FILE="$LIB/search.sh"
if [ -f "$SEARCH_FILE" ]; then
  count=$(grep -c 'browser-automation.ts' "$SEARCH_FILE" 2>/dev/null || echo 0)
  if [ "$count" -gt 0 ]; then
    echo "  OK search.sh references browser-automation.ts ($count times)"
    pass=$((pass + 1))
  else
    echo "  FAIL FAIL: search.sh does not reference browser-automation.ts"
    fail=$((fail + 1))
  fi
else
  echo "  FAIL FAIL: search.sh not found at $SEARCH_FILE"
  fail=$((fail + 1))
fi

# ════════════════════════════════════════════════════════════════════
# Test 4: Mock-based argument tests
# ════════════════════════════════════════════════════════════════════

echo ""
echo "=== Test 4: Mock-based argument tests ==="

# --- Setup mock environment ---

# Create temp file for recording bun args
BUN_ARGS_FILE="$(mktemp /tmp/gsearch-test-bun-args-XXXXXX)"
BUN_MOCK_OUTPUT='[]'
BUN_CALL_COUNT=0

# For safety, use a temp dir that definitely exists
MOCK_CDP_SCRIPTS="/tmp/gsearch-test-cdp-scripts"
mkdir -p "$MOCK_CDP_SCRIPTS"

# Mock bun() to record args
bun() {
  BUN_CALL_COUNT=$((BUN_CALL_COUNT + 1))
  printf '%s\n' "$*" > "$BUN_ARGS_FILE"
  echo "$BUN_MOCK_OUTPUT"
}

# Override globals used by cmd_search
CDP_SCRIPTS="$MOCK_CDP_SCRIPTS"
GSEARCH_CDP_PORT="9999"

reset_mock() {
  BUN_CALL_COUNT=0
  : > "$BUN_ARGS_FILE"
}

cleanup() {
  rm -f "$BUN_ARGS_FILE"
  rm -rf "$MOCK_CDP_SCRIPTS"
}
trap cleanup EXIT

# --- Test 4a: basic query passthrough ---
echo "  --- 4a: basic query passthrough ---"
reset_mock

cmd_search --count 3 "test query" 2>/dev/null || true

ARGS=$(cat "$BUN_ARGS_FILE")
echo "    bun args: $ARGS"
assert_contains "test query" "$ARGS" "4a: query 'test query' passed to bun"
assert_contains "--count 3" "$ARGS" "4a: --count 3 passed to bun"
assert_contains "--port 9999" "$ARGS" "4a: --port 9999 passed to bun"
assert_contains "browser-automation.ts" "$ARGS" "4a: browser-automation.ts in args"

# --- Test 4b: --pretty flag ---
echo "  --- 4b: --pretty flag ---"
reset_mock

cmd_search --pretty "query2" 2>/dev/null || true

ARGS=$(cat "$BUN_ARGS_FILE")
echo "    bun args: $ARGS"
assert_contains "query2" "$ARGS" "4b: query 'query2' passed to bun"
assert_not_contains "--pretty" "$ARGS" "4b: --pretty NOT passed to bun (consumed as flag)"

# --- Test 4c: default count (10) ---
echo "  --- 4c: default count ---"
reset_mock

cmd_search "default count query" 2>/dev/null || true

ARGS=$(cat "$BUN_ARGS_FILE")
echo "    bun args: $ARGS"
assert_contains "default count query" "$ARGS" "4c: query text passed"
# Default count is 10 per cmd_search
assert_contains "--count 10" "$ARGS" "4c: default --count 10"

# --- Test 4d: empty args (no query) triggers die_usage ---
echo "  --- 4d: no-argument calls die_usage ---"
reset_mock

# Capture stderr and ensure exit 1
test_die_on_no_args() {
  ( cmd_search 2>/dev/null; ) && return 1 || return 0
}
if test_die_on_no_args; then
  echo "  OK 4d: cmd_search with no args exits 1 (die_usage)"
  pass=$((pass + 1))
else
  echo "  FAIL FAIL: 4d: cmd_search with no args did not exit 1"
  fail=$((fail + 1))
fi

# --- Test 4e: --count with non-numeric triggers die_usage ---
echo "  --- 4e: --count with non-numeric ---"
reset_mock

test_die_on_bad_count() {
  ( cmd_search --count abc "query" 2>/dev/null; ) && return 1 || return 0
}
if test_die_on_bad_count; then
  echo "  OK 4e: --count abc exits 1 (die_usage)"
  pass=$((pass + 1))
else
  echo "  FAIL FAIL: 4e: --count abc did not exit 1"
  fail=$((fail + 1))
fi

# --- Test 4f: unknown option triggers die_usage ---
echo "  --- 4f: unknown option ---"
reset_mock

test_die_on_unknown_opt() {
  ( cmd_search --bogus "query" 2>/dev/null; ) && return 1 || return 0
}
if test_die_on_unknown_opt; then
  echo "  OK 4f: --bogus exits 1 (die_usage)"
  pass=$((pass + 1))
else
  echo "  FAIL FAIL: 4f: --bogus did not exit 1"
  fail=$((fail + 1))
fi

# ════════════════════════════════════════════════════════════════════
# Summary
# ════════════════════════════════════════════════════════════════════

echo ""
echo "════════════════════════════════════════════"
echo "  Results: $pass passed, $fail failed"
echo "════════════════════════════════════════════"

if [ "$fail" -eq 0 ]; then
  exit 0
else
  exit 1
fi
