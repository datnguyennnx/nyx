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
//   "coupling": [{ "a": taskId, "b": taskId, "sharedSymbols": number, "evidence": string[] }],
//   "edges": [{ "from": taskId, "to": taskId, "reason": string, "evidence": string }],
//   "graph": {
//     "adjacency": [[0,1,0],[1,0,1],[0,1,0]]  // N×N binary symmetric matrix, optional
//   }
// }
//
// OUTPUT: { H_norm, D_JS, I_norm_coupling_proxy, C_T, C_min_norm, Q, avg_conductance, C_total, routing, levels }
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

function buildAdjacency(tasks, edges, coupling) {
  const n = tasks.length;
  const adj = Array.from({ length: n }, () => Array(n).fill(0));
  for (const e of edges) {
    const i = tasks.findIndex(t => t.id === e.from);
    const j = tasks.findIndex(t => t.id === e.to);
    if (i !== -1 && j !== -1) { adj[i][j] = 1; adj[j][i] = 1; }
  }
  for (const c of coupling) {
    const i = tasks.findIndex(t => t.id === c.a);
    const j = tasks.findIndex(t => t.id === c.b);
    if (i !== -1 && j !== -1) { adj[i][j] = 1; adj[j][i] = 1; }
  }
  return adj;
}

function minCut(adj) {
  const n = adj.length;
  if (n <= 1) return 0;
  
  // Total weight for normalization
  let totalWeight = 0;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      totalWeight += adj[i][j];
  if (totalWeight === 0) return 0;
  
  // Copy adjacency since we'll modify it
  const g = adj.map(row => [...row]);
  const vertices = Array.from({length: n}, (_, i) => [i]);
  let best = Infinity;
  
  for (let phase = 0; phase < n - 1; phase++) {
    const weights = new Array(n).fill(0);
    const added = new Array(n).fill(false);
    let prev = -1;
    
    for (let i = 0; i < n - phase; i++) {
      // Pick most tightly connected vertex not yet added
      let sel = -1;
      for (let v = 0; v < n; v++) {
        if (!added[v] && (sel === -1 || weights[v] > weights[sel])) {
          sel = v;
        }
      }
      if (sel === -1) break;
      
      added[sel] = true;
      if (i === n - phase - 1) {
        // Last vertex — update best cut
        best = Math.min(best, weights[sel]);
        
        // Merge sel into prev
        for (let j = 0; j < n; j++) {
          if (j !== sel && j !== prev) {
            g[prev][j] += g[sel][j];
            g[j][prev] += g[j][sel];
          }
        }
        g[prev][sel] = 0;
        g[sel][prev] = 0;
        vertices[sel] = [];
      }
      
      prev = sel;
      
      // Update weights for remaining vertices
      for (let v = 0; v < n; v++) {
        if (!added[v]) {
          weights[v] += g[sel][v];
        }
      }
    }
  }
  
  return totalWeight > 0 ? Math.min(1, Math.max(0, best / totalWeight)) : 0;
}

function modularity(adj, levels) {
  const n = adj.length;
  if (n === 0 || levels.length === 0) return 0;
  
  // Build community assignment from levels
  const community = {};
  for (let l = 0; l < levels.length; l++) {
    for (const id of levels[l]) {
      community[id] = l;
    }
  }
  
  // Map task IDs to indices
  const ids = [];
  for (const level of levels) {
    for (const id of level) {
      ids.push(id);
    }
  }
  
  // Compute degree of each node
  const degrees = new Array(n).fill(0);
  let totalEdges = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      degrees[i] += adj[i][j];
      if (j > i) totalEdges += adj[i][j];
    }
  }
  
  if (totalEdges === 0) return 0;
  
  const m2 = 2 * totalEdges;
  let Q = 0;
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      // Check if i and j are in the same community
      const ci = community[ids[i]];
      const cj = community[ids[j]];
      if (ci !== undefined && ci === cj) {
        Q += adj[i][j] - (degrees[i] * degrees[j]) / m2;
      }
    }
  }
  
  return m2 > 0 ? Q / m2 : 0;
}

function avgConductance(adj, levels) {
  const n = adj.length;
  if (n === 0 || levels.length <= 1) return 0;
  
  // Map task IDs to indices
  const ids = [];
  for (const level of levels) {
    for (const id of level) {
      ids.push(id);
    }
  }
  
  // Build community membership
  const community = {};
  for (let l = 0; l < levels.length; l++) {
    for (const id of levels[l]) {
      community[id] = l;
    }
  }
  
  // Compute degree of each node
  const degrees = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      degrees[i] += adj[i][j];
    }
  }
  
  let totalCond = 0;
  let validClusters = 0;
  
  for (let l = 0; l < levels.length; l++) {
    const cluster = levels[l];
    if (cluster.length === 0) continue;
    
    // Cut: edges from cluster to outside
    let cut = 0;
    let vol = 0;
    const outsideVol = {vol: 0};
    
    // Compute total volume and volume of all other vertices
    let totalVol = 0;
    for (let i = 0; i < n; i++) totalVol += degrees[i];
    
    for (const id of cluster) {
      const i = ids.indexOf(id);
      if (i === -1) continue;
      vol += degrees[i];
      for (let j = 0; j < n; j++) {
        if (community[ids[j]] !== l) {
          cut += adj[i][j];
        }
      }
    }
    
    const outsideVolVal = totalVol - vol;
    const minVol = Math.min(vol, outsideVolVal);
    
    if (minVol > 0) {
      totalCond += cut / minVol;
      validClusters++;
    }
  }
  
  return validClusters > 0 ? totalCond / validClusters : 0;
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
      `Re-check P-BLOCKING edge directions.`
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
  const { tasks, domains = {}, coupling = [], edges = [], graph = {} } = loadInput();
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

  // ---------- Hybrid ensemble metrics ----------
  const adj = graph.adjacency || buildAdjacency(tasks, edges, coupling);
  // Validate adjacency dimensions
  if (adj.length !== tasks.length || adj.some(row => row.length !== tasks.length)) {
    throw new Error(`graph.adjacency must be ${tasks.length}×${tasks.length}`);
  }

  const C_min_norm = minCut(adj);
  const levels = computeLevels(tasks, edges);
  const Q = modularity(adj, levels);
  const avg_cond = avgConductance(adj, levels);

  // Default weights (learnable from empirical validation)
  const alpha = 0.4, beta = 0.3, gamma = 0.2, delta = 0.1;
  const clamped_Q = Math.min(1, Math.max(-0.5, Q));
  const C_total = alpha * C_min_norm + beta * (1 - clamped_Q) + gamma * avg_cond + delta * C_T;
  const C_total_clamped = Math.min(1, Math.max(0, C_total));

  // ---------- File overlap check ----------
  const fileConflicts = checkFileOverlap(tasks, levels);
  if (fileConflicts.length > 0) {
    throw new Error(
      `File overlap between same-level (parallel) tasks: ` +
      JSON.stringify(fileConflicts) +
      `. Add a P-WRITE edge (same file -> sequential) between these tasks in the ` +
      `input, or re-split so they don't share files, then re-run.`
    );
  }

  const routing = {
    fastLane: C_total_clamped < 0.25 && tasks.length === 1,
    splitByFileCluster: H_norm > 0.7,
    splitByDomain: D_JS > 0.15,
    sequentialRequired: I_norm > 0 || edges.length > 0,
    parallelSafe: I_norm === 0 && discoveryRan && edges.length === 0,
  };

  console.log(JSON.stringify({
    H_norm, D_JS, I_norm_coupling_proxy: I_norm, C_T,
    C_min_norm, Q, avg_conductance: avg_cond, C_total: C_total_clamped,
    routing, levels
  }, null, 2));
}

main();
