#!/usr/bin/env bash
# Test: gsearch common.sh helper functions
set -euo pipefail

# --- Setup ---
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LIB="$SCRIPT_DIR/../lib"

# Source the common lib
. "$LIB/common.sh"

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

assert_run_0() {
  local label="${2:-$1}"
  if eval "$1" 2>/dev/null; then
    echo "  OK $label"
    pass=$((pass + 1))
  else
    echo "  FAIL FAIL: $label (expected exit 0)"
    fail=$((fail + 1))
  fi
}

assert_run_1() {
  local label="${2:-$1}"
  if eval "$1" 2>/dev/null; then
    echo "  FAIL FAIL: $label (expected exit 1, got exit 0)"
    fail=$((fail + 1))
  else
    local rc=$?
    if [ $rc -eq 1 ]; then
      echo "  OK $label"
      pass=$((pass + 1))
    else
      echo "  FAIL FAIL: $label (expected exit 1, got exit $rc)"
      fail=$((fail + 1))
    fi
  fi
}

# ════════════════════════════════════════════════════════════════════
# Prerequisite checks
# ════════════════════════════════════════════════════════════════════

HAVE_NODE=false
command -v node >/dev/null 2>&1 && HAVE_NODE=true

if ! $HAVE_NODE; then
  echo "WARNING: node not found -- json_str tests will be skipped"
  echo "  (json_str depends on node for JSON encoding)"
fi

# ════════════════════════════════════════════════════════════════════
# json_str (5+ tests)
# ════════════════════════════════════════════════════════════════════

echo ""
echo "=== json_str ==="

# Test 1: empty string --> ""
if $HAVE_NODE; then
  result=$(json_str "")
  assert_eq '""' "$result" "json_str empty string"
else
  echo "  - skipped (no node)"
fi

# Test 2: simple string --> "hello"
if $HAVE_NODE; then
  result=$(json_str "hello")
  assert_eq '"hello"' "$result" "json_str simple string"
else
  echo "  - skipped (no node)"
fi

# Test 3: double quote --> properly escaped (contains \")
if $HAVE_NODE; then
  result=$(json_str 'hello "world"')
  assert_eq '"hello \"world\""' "$result" "json_str double quote"
else
  echo "  - skipped (no node)"
fi

# Test 4: single quote --> literal in JSON, no escaping needed
if $HAVE_NODE; then
  result=$(json_str "it's fine")
  assert_eq '"it'"'"'s fine"' "$result" "json_str single quote"
else
  echo "  - skipped (no node)"
fi

# Test 5: backslash --> properly escaped as \\
if $HAVE_NODE; then
  result=$(json_str 'a\b')
  assert_eq '"a\\b"' "$result" "json_str backslash"
else
  echo "  - skipped (no node)"
fi

# Test 6: dollar sign --> literal in JSON, no escaping needed
if $HAVE_NODE; then
  result=$(json_str '$HOME')
  assert_eq '"$HOME"' "$result" "json_str dollar sign"
else
  echo "  - skipped (no node)"
fi

# Test 7: backtick --> literal in JSON, no escaping needed
if $HAVE_NODE; then
  result=$(json_str '`date`')
  assert_eq '"`date`"' "$result" "json_str backtick"
else
  echo "  - skipped (no node)"
fi

# ════════════════════════════════════════════════════════════════════
# is_num (5 tests)
# ════════════════════════════════════════════════════════════════════

echo ""
echo "=== is_num ==="

# Test 1: 123 --> exit 0
assert_run_0 "is_num 123" "is_num 123"

# Test 2: 0 --> exit 0
assert_run_0 "is_num 0" "is_num 0"

# Test 3: empty string --> exit 1
assert_run_1 "is_num ''" "is_num empty string"

# Test 4: abc --> exit 1
assert_run_1 "is_num abc" "is_num abc"

# Test 5: 12a --> exit 1
assert_run_1 "is_num 12a" "is_num 12a"

# ════════════════════════════════════════════════════════════════════
# die_usage (2 tests)
# ════════════════════════════════════════════════════════════════════

echo ""
echo "=== die_usage ==="

# Test 1: Verify exit code is 1
test_die_usage_exit() {
  ( die_usage "test msg" 2>/dev/null; ) && return 1 || return 0
}
if test_die_usage_exit; then
  echo "  OK die_usage exits with 1"
  pass=$((pass + 1))
else
  echo "  FAIL FAIL: die_usage exit code is not 1"
  fail=$((fail + 1))
fi

# Test 2: Verify message is printed to stderr
test_die_usage_msg() {
  local captured
  captured=$(die_usage "expected test message" 2>&1) || true
  [ "$captured" = "expected test message" ]
}
if test_die_usage_msg; then
  echo "  OK die_usage prints message to stderr"
  pass=$((pass + 1))
else
  echo "  FAIL FAIL: die_usage stderr message mismatch"
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
