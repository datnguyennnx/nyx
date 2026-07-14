#!/usr/bin/env node
// complexity-score.test.mjs
// Hand-checked expected outputs. Covers scoring, evidence guards, level sets.
// Run: node scripts/complexity-score.test.mjs

import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";

const SCRIPT = new URL("./complexity-score.mjs", import.meta.url).pathname;

let passed = 0;
let failed = 0;

function runScore(input) {
  const tmp = `/tmp/complexity-score-test-${Date.now()}.json`;
  writeFileSync(tmp, JSON.stringify(input));
  try {
    const stdout = execFileSync("node", [SCRIPT, "--input-file", tmp], { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    return JSON.parse(stdout);
  } finally {
    if (existsSync(tmp)) unlinkSync(tmp);
  }
}

function runScoreThrows(input) {
  try { runScore(input); return null; }
  catch (e) { return e.stderr || e.message; }
}

function approx(a, b, eps = 0.01) { return Math.abs(a - b) < eps; }

function assert(name, condition, detail = "") {
  if (condition) { passed++; }
  else { failed++; console.error(`FAIL: ${name} ${detail}`); }
}

// ─── S1: Two-file task with real import coupling ───
{
  const out = runScore({
    tasks: [
      { id: "t1", delta: 2.0, files: ["src/a.ts"] },
      { id: "t2", delta: 1.0, files: ["src/b.ts"] },
    ],
    domains: {},
    coupling: [{ a: "t1", b: "t2", sharedSymbols: 2, evidence: ["src/a.ts:10", "src/b.ts:5"] }],
    edges: [{ from: "t2", to: "t1", reason: "P3: t1 imports from t2", evidence: "src/a.ts:3" }],
  });

  assert("S1 H_norm", approx(out.H_norm, 0.9183, 0.01), `got ${out.H_norm}`);
  assert("S1 D_JS", approx(out.D_JS, 0, 0.001), `got ${out.D_JS}`);
  assert("S1 I_norm", approx(out.I_norm_coupling_proxy, 0.6667, 0.01), `got ${out.I_norm_coupling_proxy}`);
  assert("S1 C_T", approx(out.C_T, 0.7925, 0.01), `got ${out.C_T}`);
  assert("S1 levels", JSON.stringify(out.levels) === JSON.stringify([["t2"], ["t1"]]), `got ${JSON.stringify(out.levels)}`);
  assert("S1 sequentialRequired", out.routing.sequentialRequired === true);
  assert("S1 parallelSafe", out.routing.parallelSafe === false);
}

// ─── S2: Two-file task with genuinely unrelated files ───
{
  const out = runScore({
    tasks: [
      { id: "t1", delta: 2.0, files: ["src/utils.ts"] },
      { id: "t2", delta: 2.0, files: ["src/legacy/format.ts"] },
    ],
    domains: {},
    coupling: [],
    edges: [],
  });

  assert("S2 H_norm", approx(out.H_norm, 1.0, 0.001), `got ${out.H_norm}`);
  assert("S2 D_JS", approx(out.D_JS, 0, 0.001), `got ${out.D_JS}`);
  assert("S2 I_norm", approx(out.I_norm_coupling_proxy, 0, 0.001), `got ${out.I_norm_coupling_proxy}`);
  assert("S2 C_T", approx(out.C_T, 1.0, 0.001), `got ${out.C_T}`);
  assert("S2 levels", JSON.stringify(out.levels) === JSON.stringify([["t1", "t2"]]), `got ${JSON.stringify(out.levels)}`);
  // parallelSafe/sequentialRequired are informational — levels drives scheduling.
  // With no edges, all tasks are in one level (parallel-safe by schedule).
}

// ─── S3: Single-file fast-lane task ───
{
  const out = runScore({
    tasks: [{ id: "t1", delta: 1.0, files: ["src/foo.ts"] }],
    coupling: [],
    edges: [],
  });

  assert("S3 H_norm", approx(out.H_norm, 0, 0.001), `got ${out.H_norm}`);
  assert("S3 D_JS", approx(out.D_JS, 0, 0.001), `got ${out.D_JS}`);
  assert("S3 C_T", approx(out.C_T, 0, 0.001), `got ${out.C_T}`);
  assert("S3 fastLane", out.routing.fastLane === true);
  assert("S3 levels", JSON.stringify(out.levels) === JSON.stringify([["t1"]]));
}

// ─── S4: Coupling pair with NO evidence — must throw ───
{
  const err = runScoreThrows({
    tasks: [{ id: "t1", delta: 2.0, files: ["a.ts"] }, { id: "t2", delta: 1.0, files: ["b.ts"] }],
    coupling: [{ a: "t1", b: "t2", sharedSymbols: 1, evidence: [] }],
    edges: [],
  });

  assert("S4 throws on no evidence", err !== null && err.includes("no evidence"), `got: ${err}`);
}

// ─── S5: Edge with no evidence — must throw ───
{
  const err = runScoreThrows({
    tasks: [{ id: "t1", delta: 2.0, files: ["a.ts"] }, { id: "t2", delta: 1.0, files: ["b.ts"] }],
    coupling: [],
    edges: [{ from: "t1", to: "t2", reason: "P3", evidence: "" }],
  });

  assert("S5 throws on edge with no evidence", err !== null && err.includes("no evidence citation"), `got: ${err}`);
}

// ─── S6: Mixed topology — 4 tasks (t1┐, t2┐→t3, t4 independent) ───
// t1 = frontend component A (delta=3, files=[CompA.tsx])
// t2 = frontend component B (delta=2, files=[CompB.tsx])
// t3 = shared hook consuming both components (delta=4, files=[useCombined.ts])
// t4 = backend api (delta=2, files=[api.ts])
// Edges: t1→t3 (P4), t2→t3 (P4)
// Expected levels: [["t1","t2","t4"], ["t3"]]
//   t1/t2/t4 have no upstream deps → same level, parallel-safe
//   t3 depends on both t1 and t2 → level 1
//   t4 is fully independent → level 0 (same level as t1/t2)
{
  const out = runScore({
    tasks: [
      { id: "t1", delta: 3.0, files: ["src/CompA.tsx"] },
      { id: "t2", delta: 2.0, files: ["src/CompB.tsx"] },
      { id: "t3", delta: 4.0, files: ["src/hooks/useCombined.ts"] },
      { id: "t4", delta: 2.0, files: ["src/api.ts"] },
    ],
    domains: { t1: "frontend", t2: "frontend", t3: "frontend", t4: "backend" },
    coupling: [
      { a: "t1", b: "t3", sharedSymbols: 2, evidence: ["src/CompA.tsx:15", "src/hooks/useCombined.ts:5"] },
      { a: "t2", b: "t3", sharedSymbols: 2, evidence: ["src/CompB.tsx:20", "src/hooks/useCombined.ts:8"] },
    ],
    edges: [
      { from: "t1", to: "t3", reason: "P4: t3 consumes t1's export type", evidence: "src/hooks/useCombined.ts:5" },
      { from: "t2", to: "t3", reason: "P4: t3 consumes t2's export type", evidence: "src/hooks/useCombined.ts:8" },
    ],
  });

  assert("S6 H_norm", approx(out.H_norm, 0.962, 0.02), `got ${out.H_norm}`);
  assert("S6 D_JS > 0", out.D_JS > 0, `got ${out.D_JS}`);
  assert("S6 I_norm > 0", out.I_norm_coupling_proxy > 0, `got ${out.I_norm_coupling_proxy}`);
  assert("S6 C_T", out.C_T > 0, `got ${out.C_T}`);

  // Check level structure: t1, t2, t4 in level 0 (order doesn't matter), t3 in level 1
  const l0 = out.levels[0].sort();
  const l1 = out.levels[1].sort();
  assert("S6 level0 has t1,t2,t4", JSON.stringify(l0) === JSON.stringify(["t1", "t2", "t4"].sort()), `got ${JSON.stringify(l0)}`);
  assert("S6 level1 has t3", JSON.stringify(l1) === JSON.stringify(["t3"]), `got ${JSON.stringify(l1)}`);
  assert("S6 2 levels", out.levels.length === 2, `got ${out.levels.length} levels`);
  assert("S6 sequentialRequired (has edges)", out.routing.sequentialRequired === true);
  assert("S6 parallelSafe false", out.routing.parallelSafe === false);
}

// ─── S7: File overlap between same-level tasks — must throw ───
{
  const err = runScoreThrows({
    tasks: [
      { id: "t1", delta: 2.0, files: ["src/shared.ts", "src/a.ts"] },
      { id: "t2", delta: 2.0, files: ["src/shared.ts", "src/b.ts"] },
    ],
    coupling: [],
    edges: [],
  });

  assert("S7 throws on file overlap", err !== null && err.includes("File overlap"), `got: ${err}`);
}

// ─── S8: Cycle in edges — must throw ───
{
  const err = runScoreThrows({
    tasks: [
      { id: "t1", delta: 2.0, files: ["a.ts"] },
      { id: "t2", delta: 2.0, files: ["b.ts"] },
    ],
    coupling: [],
    edges: [
      { from: "t1", to: "t2", reason: "P3", evidence: "a.ts:1" },
      { from: "t2", to: "t1", reason: "P3", evidence: "b.ts:1" },
    ],
  });

  assert("S8 throws on cycle", err !== null && err.includes("Cycle detected"), `got: ${err}`);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
