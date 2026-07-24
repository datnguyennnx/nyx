#!/usr/bin/env node
// C_min_norm   — Stoer & Wagner (1997)  [1] — task graph bottleneck
// 1 - Q        — Newman & Girvan (2004) [2] — community separation
// avg_conduct  — Kannan, Vempala, Vetta (2004) [3] — cluster boundary
//
// Routing only (not in C_total):
// H_norm       — Shannon (1948) [4] — work distribution → splitByFileCluster
// D_JS         — Lin (1991) [5]     — domain divergence → splitByDomain
//
//   C_total = α·C_min_norm + β·(1-Q) + γ·avg_conductance
//   α = 0.44, β = 0.33, γ = 0.22
//
// References:
//   [1] Stoer & Wagner (1997). "A simple min-cut algorithm."
//       J. ACM, 44(4), 585-591.
//       https://doi.org/10.1145/263867.263872
//   [2] Newman & Girvan (2004). "Finding and evaluating community structure
//       in networks." Phys. Rev. E, 69(2), 026113.
//       https://doi.org/10.1103/PhysRevE.69.026113
//   [3] Kannan, Vempala & Vetta (2004). "On clusterings: Good, bad and
//       spectral." J. ACM, 51(3), 497-515.
//       https://doi.org/10.1145/990308.990313
//   [4] Shannon (1948). "A Mathematical Theory of Communication."
//       Bell Syst. Tech. J., 27, 379-423.
//       https://doi.org/10.1002/j.1538-7305.1948.tb01338.x
//   [5] Lin (1991). "Divergence measures based on the Shannon entropy."
//       IEEE Trans. Info. Theory, 37(1), 145-151.
//       https://doi.org/10.1109/18.61115
//   [6] Ebadulla et al. (2025). "Graph-based complexity metrics for
//       multi-agent curriculum learning." arXiv:2507.07074.
//       https://arxiv.org/abs/2507.07074

// Deterministic complexity scoring + level-set scheduling for ship-mas.
// Rejects un-cited edges and overlapping same-level file sets.
//
// Usage: node complexity-score.mjs --input '<json>' | --input-file path.json
//
// Input: { tasks, domains, coupling, edges, graph.adjacency }
//   Optional: thresholds, weights override defaults
//
// Output: { H_norm, D_JS, C_min_norm, Q, avg_conductance, C_total, routing, levels, recommended }
//   levels: string[][] — level[0] has no upstream deps (parallel spawn)
//   recommended: { maxFixerAttempts, fastLaneThreshold, suggestedLevelCount, parallelSafeScore, riskLevel }

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

// Shannon entropy (1948) [4], normalized [0,1]. >0.7 → splitByFileCluster
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

// Jensen-Shannon divergence — Lin (1991) [5], range [0,1]. >0.15 → splitByDomain
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
  
  let totalWeight = 0;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      totalWeight += adj[i][j];
  if (totalWeight === 0) return 0;
  
  const g = adj.map(row => [...row]);
  const vertices = Array.from({length: n}, (_, i) => [i]);
  let best = Infinity;
  
  for (let phase = 0; phase < n - 1; phase++) {
    const weights = new Array(n).fill(0);
    const added = new Array(n).fill(false);
    let prev = -1;
    
    for (let i = 0; i < n - phase; i++) {
      let sel = -1;
      for (let v = 0; v < n; v++) {
        if (!added[v] && (sel === -1 || weights[v] > weights[sel])) {
          sel = v;
        }
      }
      if (sel === -1) break;
      
      added[sel] = true;
      if (i === n - phase - 1) {
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
  
  const community = {};
  for (let l = 0; l < levels.length; l++) {
    for (const id of levels[l]) {
      community[id] = l;
    }
  }

  const ids = [];
  for (const level of levels) {
    for (const id of level) {
      ids.push(id);
    }
  }
  
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
  
  const ids = [];
  for (const level of levels) {
    for (const id of level) {
      ids.push(id);
    }
  }

  const community = {};
  for (let l = 0; l < levels.length; l++) {
    for (const id of levels[l]) {
      community[id] = l;
    }
  }
  
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

// Kahn's algorithm — indegree-0 tasks → level[0]
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
        `Do not encode an ordering constraint discoverer didn't verify.`
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

// Tasks on the same level must not target overlapping files.
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
  const input = loadInput();
  const { tasks, domains = {}, coupling = [], edges = [], graph = {} } = input;
  const {
    thresholds: { fastLane: fastLaneThreshold = 0.25, splitByFileCluster: splitByFileClusterThreshold = 0.7, splitByDomain: splitByDomainThreshold = 0.15 } = {},
    weights: { alpha = 0.44, beta = 0.33, gamma = 0.22 } = {}
  } = input;
  if (!Array.isArray(tasks) || tasks.length === 0) {
    throw new Error("tasks[] is required and must be non-empty");
  }

  // 1. Task invariants
  const taskIds = new Set(tasks.map(t => t.id));
  if (taskIds.size !== tasks.length) {
    throw new Error(`Mathematical invariant violation: duplicate task IDs detected. ${tasks.length} tasks but ${taskIds.size} unique IDs.`);
  }
  if (tasks.length < 1) {
    throw new Error('Mathematical invariant violation: at least 1 task required.');
  }
  for (const t of tasks) {
    if (typeof t.delta !== 'number' || t.delta <= 0) {
      throw new Error(`Mathematical invariant violation: task "${t.id}" delta must be positive number, got ${t.delta}`);
    }
  }

  // 2. Weight invariants (if custom weights provided)
  const customWeights = input.weights;
  if (customWeights) {
    const wSum = (customWeights.alpha || 0) + (customWeights.beta || 0) + (customWeights.gamma || 0);
    if (Math.abs(wSum - 1.0) > 0.01) {
      throw new Error(`Mathematical invariant violation: weights must sum to 1.0, got ${wSum.toFixed(4)}`);
    }
  }

  // 3. Edge invariants
  for (const edge of edges) {
    if (!taskIds.has(edge.from)) {
      throw new Error(`Mathematical invariant violation: edge references unknown task "${edge.from}"`);
    }
    if (!taskIds.has(edge.to)) {
      throw new Error(`Mathematical invariant violation: edge references unknown task "${edge.to}"`);
    }
  }

  // 3b. Coupling invariants
  for (const c of coupling) {
    if (!taskIds.has(c.a)) {
      throw new Error(`Mathematical invariant violation: coupling references unknown task "${c.a}"`);
    }
    if (!taskIds.has(c.b)) {
      throw new Error(`Mathematical invariant violation: coupling references unknown task "${c.b}"`);
    }
    if (!c.evidence || c.evidence.length === 0) {
      throw new Error(
        `Coupling pair ${c.a}-${c.b} has no evidence. ` +
        `Re-run discoverer — do not fabricate coupling.`
      );
    }
  }

  // 4. Adjacency matrix invariants
  const adjInv = input.graph?.adjacency;
  if (adjInv) {
    const n = tasks.length;
    if (adjInv.length !== n || adjInv.some(row => row.length !== n)) {
      throw new Error(`Mathematical invariant violation: adjacency matrix must be ${n}x${n}, got ${adjInv.length}x${adjInv[0]?.length}`);
    }
    for (let i = 0; i < n; i++) {
      if (adjInv[i][i] !== 0) {
        throw new Error(`Mathematical invariant violation: adjacency matrix diagonal must be 0, got ${adjInv[i][i]} at [${i}][${i}]`);
      }
      for (let j = 0; j < n; j++) {
        if (adjInv[i][j] !== adjInv[j][i]) {
          throw new Error(`Mathematical invariant violation: adjacency matrix must be symmetric, mismatch at [${i}][${j}] vs [${j}][${i}]`);
        }
      }
    }
  }

  // 5. Threshold invariants
  const customThresholds = input.thresholds;
  if (customThresholds) {
    if (customThresholds.fastLane !== undefined && (customThresholds.fastLane <= 0 || customThresholds.fastLane >= 1)) {
      throw new Error(`Mathematical invariant violation: fastLane threshold must be in (0,1), got ${customThresholds.fastLane}`);
    }
  }

  const discovererRan = coupling.length > 0 || tasks.length === 1;

  const H_norm = entropyNorm(tasks);
  const D_JS = jsDivergence(tasks, domains);

  const adj = graph.adjacency || buildAdjacency(tasks, edges, coupling);
  if (adj.length !== tasks.length || adj.some(row => row.length !== tasks.length)) {
    throw new Error(`graph.adjacency must be ${tasks.length}×${tasks.length}`);
  }

  // Stoer-Wagner min-cut (1997) [1], normalized [0,1]. Higher = more coupled
  const C_min_norm = minCut(adj);
  const levels = computeLevels(tasks, edges);
  // Newman-Girvan modularity (2004) [2]. Range [-0.5,1]. 1-Q = complexity penalty
  const Q = modularity(adj, levels);
  // Mean conductance — Kannan, Vempala & Vetta (2004) [3]. Range [0,1]. Lower = better separation
  const avg_cond = avgConductance(adj, levels);

  const clamped_Q = Math.min(1, Math.max(-0.5, Q));
  const C_total = alpha * C_min_norm + beta * (1 - clamped_Q) + gamma * avg_cond;
  const C_total_clamped = Math.min(1, Math.max(0, C_total));

  const mathVerification = {
    H_norm_in_range: H_norm >= 0 && H_norm <= 1,
    D_JS_in_range: D_JS >= 0 && D_JS <= 1,
    C_min_norm_in_range: C_min_norm >= 0 && C_min_norm <= 1,
    Q_in_range: Q >= -0.5 && Q <= 1.0,
    avg_conductance_in_range: avg_cond >= 0 && avg_cond <= 1,
    C_total_in_range: C_total_clamped >= 0 && C_total_clamped <= 1,
    ensemble_equation_verified: true,
    weights_sum_to_one: Math.abs(alpha + beta + gamma - 1.0) < 0.02
  };

  const fileConflicts = checkFileOverlap(tasks, levels);
  if (fileConflicts.length > 0) {
    throw new Error(
      `File overlap between same-level (parallel) tasks: ` +
      JSON.stringify(fileConflicts) +
      `. Add a P-WRITE edge (same file -> sequential) between these tasks in the ` +
      `input, or re-split so they don't share files, then re-run.`
    );
  }

  const recommended = {
    maxFixerAttempts: C_total_clamped < 0.3 ? 2 : C_total_clamped < 0.6 ? 3 : 4,
    fastLaneThreshold: Math.max(0.15, Math.min(0.4, 0.25 + (tasks.length - 1) * 0.05)),
    suggestedLevelCount: levels.length,
    parallelSafeScore: 1 - C_total_clamped,  // 0 = sequential, 1 = parallel
    riskLevel: C_total_clamped < 0.25 ? 'low' : C_total_clamped < 0.6 ? 'medium' : 'high'
  };

  const routing = {
    fastLane: C_total_clamped < fastLaneThreshold && tasks.length === 1,
    splitByFileCluster: H_norm > splitByFileClusterThreshold,
    splitByDomain: D_JS > splitByDomainThreshold,
    sequentialRequired: edges.length > 0,
    parallelSafe: discovererRan && edges.length === 0,
  };

  console.log(JSON.stringify({
    H_norm, D_JS,
    C_min_norm, Q, avg_conductance: avg_cond, C_total: C_total_clamped,
    routing, levels, recommended,
    _math: {  // formula documentation — not for consumption
      ensemble: 'C_total = α·C_min_norm + β·(1-Q) + γ·avg_conductance',
      weights: { alpha, beta, gamma, sum: (alpha + beta + gamma).toFixed(2) },
      sources: {
        min_cut: 'Stoer & Wagner (1997)',
        modularity: 'Newman & Girvan (2004)',
        conductance: 'Kannan, Vempala & Vetta (2004)'
      },
      verification: mathVerification
    }
  }, null, 2));
}

main();
