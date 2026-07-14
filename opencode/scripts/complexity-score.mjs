#!/usr/bin/env node
// complexity-score.mjs
// Deterministic complexity scoring + level-set scheduling for ship-mas.
// Replaces LLM mental-math with actual computation.
// Rejects un-cited edges and overlapping same-level file sets.
//
// USAGE:
//   node complexity-score.mjs --input '<json>'
//   node complexity-score.mjs --input-file path.json
//
// INPUT SCHEMA:
// {
//   "tasks": [{ "id": string, "delta": number, "files": string[] }],
//   "domains": { [taskId: string]: string },
//   "coupling": [{                        // feeds aggregate C(T) score
//     "a": taskId, "b": taskId,
//     "sharedSymbols": number,
//     "evidence": string[]
//   }],
//   "edges": [{                           // feeds schedule (level sets)
//     "from": taskId, "to": taskId,
//     "reason": string,
//     "evidence": string
//   }]
// }
//
// OUTPUT: { H_norm, D_JS, I_norm_coupling_proxy, C_T, routing, levels }
//   levels: string[][] — level[0] tasks have no upstream deps and can be
//   spawned in parallel; level[1] tasks depend only on level[0], etc.

import { readFileSync } from "node:fs";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input") out.input = argv[++i];
    if (argv[i] === "--input-file") out.inputFile = argv[++i];
  }
  return out;
}

function loadInput() {
  const { input, inputFile } = parseArgs(process.argv.slice(2));
  const raw = inputFile ? readFileSync(inputFile, "utf8") : input;
  if (!raw) {
    console.error("Missing --input or --input-file");
    process.exit(1);
  }
  return JSON.parse(raw);
}

function entropyNorm(tasks) {
  const n = tasks.length;
  if (n <= 1) return 0;
  const total = tasks.reduce((s, t) => s + t.delta, 0);
  if (total <= 0) throw new Error("Sum of deltas must be > 0");
  const H = tasks.reduce((s, t) => {
    const p = t.delta / total;
    return p > 0 ? s - p * Math.log2(p) : s;
  }, 0);
  return H / Math.log2(n);
}

function jsDivergence(tasks, domains) {
  const domainKeys = [...new Set(Object.values(domains ?? {}))];
  if (domainKeys.length < 2) return 0;
  const [domA, domB] = domainKeys
    .map((d) => ({
      d,
      weight: tasks.filter((t) => domains[t.id] === d).reduce((s, t) => s + t.delta, 0),
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2);
  const total = domA.weight + domB.weight;
  if (total === 0) return 0;
  const pA = domA.weight / total;
  const pB = domB.weight / total;
  const kl = (p, q) => (p > 0 ? p * Math.log2(p / q) : 0);
  return 0.5 * kl(pA, 0.5) + 0.5 * kl(pB, 0.5);
}

function couplingProxy(coupling, tasks) {
  if (!coupling || coupling.length === 0) return 0;
  for (const c of coupling) {
    if (!c.evidence || c.evidence.length === 0) {
      throw new Error(
        `Coupling pair ${c.a}-${c.b} has no evidence. ` +
        `Re-run discovery — do not fabricate coupling.`
      );
    }
  }
  const maxPairs = (tasks.length * (tasks.length - 1)) / 2;
  const total = coupling.reduce((s, c) => s + c.sharedSymbols, 0);
  return Math.min(1, total / Math.max(1, maxPairs * 3));
}

// Kahn's algorithm — level sets. Tasks with indegree 0 go in level[0].
// A task advances to a level once all incoming edges are resolved.
function computeLevels(tasks, edges) {
  const ids = tasks.map((t) => t.id);
  const idSet = new Set(ids);
  const indegree = Object.fromEntries(ids.map((id) => [id, 0]));
  const adj = Object.fromEntries(ids.map((id) => [id, []]));

  for (const e of edges) {
    if (!idSet.has(e.from) || !idSet.has(e.to)) {
      throw new Error(`Edge references unknown task: ${e.from} -> ${e.to}`);
    }
    if (!e.evidence) {
      throw new Error(
        `Edge ${e.from} -> ${e.to} has no evidence citation. ` +
        `Do not encode an ordering constraint discovery didn't verify.`
      );
    }
    adj[e.from].push(e.to);
    indegree[e.to]++;
  }

  const levels = [];
  const visited = new Set();
  let frontier = ids.filter((id) => indegree[id] === 0);

  while (frontier.length > 0) {
    levels.push(frontier);
    frontier.forEach((id) => visited.add(id));
    const next = new Set();
    for (const id of frontier) {
      for (const nb of adj[id]) {
        indegree[nb]--;
        if (indegree[nb] === 0) next.add(nb);
      }
    }
    frontier = [...next];
  }

  if (visited.size !== ids.length) {
    const stuck = ids.filter((id) => !visited.has(id));
    throw new Error(
      `Cycle detected in DAG edges — cannot schedule: ${stuck.join(", ")}. ` +
      `Re-check P1-P4 edge directions.`
    );
  }

  return levels;
}

// Two tasks with no import edge can still collide targeting the same file.
// Check each level's declared file sets for overlap.
function checkFileOverlap(tasks, levels) {
  const filesById = Object.fromEntries(
    tasks.map((t) => [t.id, new Set(t.files ?? [])])
  );
  const conflicts = [];
  for (const level of levels) {
    for (let i = 0; i < level.length; i++) {
      for (let j = i + 1; j < level.length; j++) {
        const overlap = [...filesById[level[i]]].filter((f) => filesById[level[j]].has(f));
        if (overlap.length > 0) {
          conflicts.push({ a: level[i], b: level[j], files: overlap });
        }
      }
    }
  }
  return conflicts;
}

function main() {
  const { tasks, domains = {}, coupling = [], edges = [] } = loadInput();
  if (!Array.isArray(tasks) || tasks.length === 0) {
    throw new Error("tasks[] is required and must be non-empty");
  }

  const discoveryRan = coupling.length > 0 || tasks.length === 1;

  const H_norm = entropyNorm(tasks);
  const D_JS = jsDivergence(tasks, domains);
  const I_norm = couplingProxy(coupling, tasks);

  const activeFlags = [tasks.length > 1, D_JS > 0, coupling.length > 0];
  const k = Math.max(1, activeFlags.filter(Boolean).length);
  const C_T = (H_norm + D_JS + I_norm) / k;

  const levels = computeLevels(tasks, edges);
  const fileConflicts = checkFileOverlap(tasks, levels);
  if (fileConflicts.length > 0) {
    throw new Error(
      `File overlap between same-level (parallel) tasks: ` +
      JSON.stringify(fileConflicts) +
      `. Add a P6 edge (same file -> sequential) between these tasks in the ` +
      `input, or re-split so they don't share files, then re-run.`
    );
  }

  const routing = {
    fastLane: C_T < 0.25 && tasks.length === 1,
    splitByFileCluster: H_norm > 0.7,
    splitByDomain: D_JS > 0.15,
    // Informational only — levels[] drives actual scheduling
    sequentialRequired: I_norm > 0 || edges.length > 0,
    parallelSafe: I_norm === 0 && discoveryRan && edges.length === 0,
  };

  console.log(JSON.stringify({ H_norm, D_JS, I_norm_coupling_proxy: I_norm, C_T, routing, levels }, null, 2));
}

main();
