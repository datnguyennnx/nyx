/**
 * MAS Engine — Deterministic Mechanical Orchestrator
 *
 * This plugin is the pure TypeScript control layer of the MAS architecture.
 * It validates spawn manifests, dehydrates context, mechanically gates patches,
 * and dispatches generic LLM compute agents via the opencode SDK.
 *
 * The engine is a "dumb pipe": it executes exactly what the manifest declares.
 * No LLM routing, no LLM classification, no LLM context management.
 * All routing, phase chains, skill injections, and context budgets are
 * declared explicitly in spawn_manifest.json by the Tier-1 decomposer.
 *
 * Architecture:
 *   Validator → Dehydrator → SpawnBridge → MechanicalGates → HITL Payload
 *
 * Plugin loaded from ~/.config/opencode/plugins/mas-engine.ts
 * Schema at    ~/.config/opencode/schemas/spawn-manifest.schema.json
 * Skills from  ~/.config/opencode/skills/<name>/SKILL.md
 * Agents from  ~/.config/opencode/agents/<name>.md (5 generic templates)
 */

import { type Plugin, type PluginInput, tool } from "@opencode-ai/plugin"
import { execSync } from "node:child_process"
import { readFileSync, existsSync, readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs"
import { join, resolve, dirname, relative, basename } from "node:path"
import { fileURLToPath } from "node:url"

// ─── Workspace Isolation Policy ────────────────────────────────────────────
// The global ~/.config/opencode/ directory is READ-ONLY. It is used solely
// for loading agents, schemas, and skills. The engine NEVER writes to it.
//
// ALL operational artifacts (run results, diff outputs, execution logs) are
// written to ./.opencode/runs/<workflow_id>/ relative to the project worktree
// (process.cwd()). This ensures strict isolation between projects.
//
//   GLOBAL (read-only):  ~/.config/opencode/{agents,schemas,skills,plugins}/
//   LOCAL  (read-write): ./.opencode/{manifests,runs,session-state}/

// ─── External: AJV for JSON Schema validation ───────────────────────────────
// Installed via package.json dependencies. opencode runs `bun install` at startup.
// We use dynamic require to avoid ESM/CJS resolution issues in the Bun runtime.
const _require = (typeof require !== "undefined") ? require : (await import("node:module")).createRequire(import.meta.url)
const Ajv2020 = _require("ajv/dist/2020.js")
const addFormats = _require("ajv-formats")

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: TYPE DEFINITIONS
// Heavy-typed manifest model — mirrors spawn-manifest.schema.json exactly.
// ═══════════════════════════════════════════════════════════════════════════

type Domain = "effect-ts" | "react-vite" | "shared"
type Concern = "error-handling" | "performance" | "concurrency" | "resource-lifecycle" | "data-validation" | "principle-check" | null
type Language = "typescript" | "javascript" | "rust" | "go" | "python"
type RoutingDecision = "fast_lane" | "full_dag"
type PhaseName = "discover" | "architect" | "implement" | "verify" | "fix" | "gate"
type PhaseType = "llm" | "mechanical"
type AgentName = "discovery" | "architect" | "implementer" | "verifier" | "fixer"
type GateName = "edge-judge"
type ContextTier = 1 | 2 | 3 | "diff"
type Conditional = "always" | "on_verify_fail"
type EdgeReason = "shared_type_file" | "shared_db_migration" | "same_effect_layer" | "import_dependency" | "type_contract_dependency" | "same_file_conservative"
type NodeType = "task" | "pre_node"
type ReentryStrategy = "affected" | "all" | "redecompose"

interface Delta {
  added: string[]
  removed: string[]
}

interface ScopeLines {
  file: string
  start: number
  end: number
}

interface Requirement {
  id: string
  statement: string
  acceptance_files: string[]
  acceptance_symbols?: string[]
}

interface Phase {
  phase: PhaseName
  type: PhaseType
  agent?: AgentName
  gate?: GateName
  skills?: string[]
  context_tier?: ContextTier
  conditional?: Conditional
  max_steps?: number
}

interface RetryBudget {
  max_respins: number
}

interface ContextBudget {
  max_tokens: number
}

interface ManifestNode {
  id: string
  node_type: NodeType
  satisfies: string[]
  domain: Domain
  concern?: Concern
  target_files: string[]
  scope_lines?: ScopeLines[]
  language: Language
  mutation: string
  output_files?: string[]
  imports_delta?: Delta
  exports_delta?: Delta
  touches_symbols?: string[]
  phase_chain: Phase[]
  retry_budget: RetryBudget
  context_budget: ContextBudget
}

interface Edge {
  from: string
  to: string
  reason: EdgeReason
}

interface ReentryPoint {
  reenter_phase: PhaseName
  target_node_strategy: ReentryStrategy
}

interface Manifest {
  manifest_version: string
  workflow_id: string
  source: {
    decomposer: string
    decomposer_model: string
    user_message: string
    domain_set: Domain[]
    created_at: string
  }
  routing_decision: RoutingDecision
  complexity?: {
    score: number
    h_norm?: number
    d_js?: number
    i_norm?: number
    user_intent_signal?: boolean
  }
  requirements: Requirement[]
  nodes: ManifestNode[]
  edges: Edge[]
  levels: string[][]
  gates: {
    per_level: { ast_aggregator: boolean }
    terminal: { global_judge: boolean }
  }
  hitl: {
    required: boolean
    max_feedback_loops: number
    reentry_routing?: Record<string, ReentryPoint>
  }
  metadata: {
    total_nodes: number
    total_edges: number
    total_levels: number
    max_width: number
  }
}

// ─── Engine-internal types (not in manifest) ───────────────────────────────

interface FileDiff {
  file: string
  before: string
  after: string
  additions: number
  deletions: number
}

interface PhaseOutput {
  phase: PhaseName
  agent?: AgentName
  text: string
  diffs?: FileDiff[]
  verdict?: "PASS" | "FAIL"
  violations?: VerifierViolation[]
  fault_vector?: FaultVector
  session_id?: string
}

interface VerifierViolation {
  file: string
  line: number
  rule: string
  skill: string
  evidence: string
  severity: "BLOCKING" | "NON_BLOCKING"
  confidence: "HIGH" | "MEDIUM" | "LOW"
}

interface FaultVector {
  severity: "NONE" | "LOW" | "CRITICAL"
  anomaly_type: "NONE" | "SYNTAX_ERROR" | "SCOPE_ESCAPE" | "DATA_HOLLOWING"
  description: string
  checks_run: {
    syntax_compliance: "PASS" | "FAIL"
    data_hollowing: "PASS" | "FAIL"
    scope_escape: "PASS" | "FAIL"
  }
}

interface NodeResult {
  node_id: string
  status: "APPROVED" | "REJECTED" | "UNRESOLVABLE_ANOMALY"
  phases: PhaseOutput[]
  final_diffs: FileDiff[]
  edge_judge_verdict: "APPROVED" | "REJECTED"
  respins_used: number
  fault_vector?: FaultVector
}

interface LevelResult {
  level_index: number
  node_results: NodeResult[]
  ast_aggregator_result?: ASTAggregatorResult
}

interface ASTAggregatorResult {
  merge_status: "SUCCESS" | "PARTIAL_CONFLICT"
  consolidated_diffs: FileDiff[]
  collisions: Collision[]
  isolated_lanes: string[]
}

interface Collision {
  class: "LINE_OVERLAP" | "VARIABLE_COLLISION" | "IMPORT_CONFLICT" | "SIGNATURE_DIVERGENCE" | "ORDERING_VIOLATION" | "PATTERN_INCONSISTENCY"
  patches_involved: string[]
  file: string
  lines?: string
  resolution: string
}

interface GlobalJudgeResult {
  verdict: "APPROVED" | "APPROVED_WITH_NOTES" | "NEEDS_REMEDIATION"
  integrity_score: number
  integrity_level: "FULL_INTEGRITY" | "MINOR_GAPS" | "SIGNIFICANT_GAPS" | "CORRUPTED"
  coverage: {
    total: number
    covered: number
    missing: number
    missing_detail: string[]
  }
  mutations: {
    total: number
    justified: number
    derived: number
    unplanned: number
    corrupted: number
  }
  regression_vectors: Array<{ file: string; symbol: string; severity: string }>
  ready_for_workspace: boolean
}

interface EngineResult {
  workflow_id: string
  routing_decision: RoutingDecision
  levels: LevelResult[]
  global_judge_result?: GlobalJudgeResult
  hitl_payload: HITLPayload
  status: "COMPLETE" | "BLOCKED" | "ESCALATED"
}

interface HITLPayload {
  workflow_id: string
  summary: string
  proposed_changes: Array<{ node_id: string; files: string[]; description: string }>
  integrity_score: number
  global_judge_verdict: string
  blocking_issues: string[]
  status: "AWAITING_CONFIRMATION" | "BLOCKED" | "ESCALATED"
}

interface ValidationResult {
  valid: boolean
  errors: string[]
  ajv_errors?: unknown[]
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: VALIDATOR MODULE
// AJV schema validation + 8 cross-document referential integrity constraints.
// ═══════════════════════════════════════════════════════════════════════════

const SCHEMA_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "..", "schemas", "spawn-manifest.schema.json")

function loadSchema(): object {
  const raw = readFileSync(SCHEMA_PATH, "utf-8")
  return JSON.parse(raw)
}

let _ajvValidator: ((data: unknown) => boolean) | null = null
let _ajvInstance: InstanceType<typeof Ajv2020> | null = null

function getAjvValidator(): (data: unknown) => boolean {
  if (_ajvValidator) return _ajvValidator
  const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true })
  addFormats(ajv)
  const schema = loadSchema()
  _ajvValidator = ajv.compile(schema)
  _ajvInstance = ajv
  return _ajvValidator
}

/**
 * Validate a manifest object against the JSON Schema AND the 8 cross-document
 * referential integrity constraints that JSON Schema cannot express.
 *
 * Constraints:
 *  C1: R-ID integrity — every node.satisfies[] value exists in requirements[].id
 *  C2: N-ID integrity — every edge.from/to exists in nodes[].id
 *  C3: Levels coverage — every node ID appears exactly once across all levels[]
 *  C4: Topological validity — levels[] is a valid topological sort of edges[]
 *  C5: Metadata consistency — counts match actual array lengths
 *  C6: Skill existence — every skill name in phase_chain has a SKILL.md file
 *  C7: Fast-lane constraint — fast_lane implies 1 node, 0 edges, 1 level
 *  C8: Coverage completeness — every requirement.id is referenced by >=1 task node
 */
function validateManifest(manifest: Manifest, skillsDir: string): ValidationResult {
  const errors: string[] = []

  // ── Phase 1: AJV JSON Schema validation ──────────────────────────────────
  const ajvValidate = getAjvValidator()
  const ajvValid = ajvValidate(manifest)
  if (!ajvValid) {
    const ajvErrors = (ajvValidate as { errors?: ErrorObj[] }).errors || []
    for (const e of ajvErrors) {
      errors.push(`[SCHEMA] ${e.instancePath || "/"} → ${e.message || "invalid"}${e.params?.allowedValues ? ` (allowed: ${JSON.stringify(e.params.allowedValues)})` : ""}`)
    }
    return { valid: false, errors }
  }

  // ── Phase 2: Cross-document referential integrity ────────────────────────

  const reqIds = new Set(manifest.requirements.map((r) => r.id))
  const nodeIds = new Set(manifest.nodes.map((n) => n.id))
  const nodeMap = new Map(manifest.nodes.map((n) => [n.id, n]))

  // C1: R-ID integrity
  for (const node of manifest.nodes) {
    for (const rid of node.satisfies) {
      if (!reqIds.has(rid)) {
        errors.push(`[C1-RID] Node ${node.id} satisfies "${rid}" but no requirement has that ID`)
      }
    }
  }

  // C2: N-ID integrity
  for (const edge of manifest.edges) {
    if (!nodeIds.has(edge.from)) {
      errors.push(`[C2-NID] Edge from "${edge.from}" → "${edge.to}": source node does not exist`)
    }
    if (!nodeIds.has(edge.to)) {
      errors.push(`[C2-NID] Edge from "${edge.from}" → "${edge.to}": target node does not exist`)
    }
    if (edge.from === edge.to) {
      errors.push(`[C2-NID] Edge from "${edge.from}" → "${edge.to}": self-loop detected`)
    }
  }

  // C3: Levels coverage — every node appears exactly once
  const levelNodeCount = new Map<string, number>()
  for (const level of manifest.levels) {
    for (const nid of level) {
      levelNodeCount.set(nid, (levelNodeCount.get(nid) || 0) + 1)
    }
  }
  for (const node of manifest.nodes) {
    const count = levelNodeCount.get(node.id) || 0
    if (count === 0) {
      errors.push(`[C3-LEVELS] Node ${node.id} does not appear in any level`)
    } else if (count > 1) {
      errors.push(`[C3-LEVELS] Node ${node.id} appears ${count} times across levels (must be exactly 1)`)
    }
  }
  for (const [nid, count] of levelNodeCount) {
    if (!nodeIds.has(nid)) {
      errors.push(`[C3-LEVELS] Level references node "${nid}" which does not exist in nodes[]`)
    }
  }

  // C4: Topological validity — levels must respect edges
  // Build a map: node → earliest level index
  const nodeLevelIndex = new Map<string, number>()
  for (let i = 0; i < manifest.levels.length; i++) {
    for (const nid of manifest.levels[i]) {
      nodeLevelIndex.set(nid, i)
    }
  }
  for (const edge of manifest.edges) {
    const fromLevel = nodeLevelIndex.get(edge.from)
    const toLevel = nodeLevelIndex.get(edge.to)
    if (fromLevel === undefined || toLevel === undefined) continue // already caught by C2/C3
    if (fromLevel >= toLevel) {
      errors.push(`[C4-TOPO] Edge ${edge.from}→${edge.to} (reason: ${edge.reason}): source is at level ${fromLevel} but target is at level ${toLevel} — levels are not a valid topological sort`)
    }
  }

  // C5: Metadata consistency
  if (manifest.metadata.total_nodes !== manifest.nodes.length) {
    errors.push(`[C5-META] metadata.total_nodes=${manifest.metadata.total_nodes} but nodes.length=${manifest.nodes.length}`)
  }
  if (manifest.metadata.total_edges !== manifest.edges.length) {
    errors.push(`[C5-META] metadata.total_edges=${manifest.metadata.total_edges} but edges.length=${manifest.edges.length}`)
  }
  if (manifest.metadata.total_levels !== manifest.levels.length) {
    errors.push(`[C5-META] metadata.total_levels=${manifest.metadata.total_levels} but levels.length=${manifest.levels.length}`)
  }
  const actualMaxWidth = manifest.levels.reduce((max, lvl) => Math.max(max, lvl.length), 0)
  if (manifest.metadata.max_width !== actualMaxWidth) {
    errors.push(`[C5-META] metadata.max_width=${manifest.metadata.max_width} but actual max level width=${actualMaxWidth}`)
  }

  // C6: Skill existence — each skill name must have a SKILL.md file
  for (const node of manifest.nodes) {
    for (const phase of node.phase_chain) {
      if (phase.type === "llm" && phase.skills) {
        for (const skillName of phase.skills) {
          const skillPath = join(skillsDir, skillName, "SKILL.md")
          if (!existsSync(skillPath)) {
            errors.push(`[C6-SKILL] Node ${node.id} phase "${phase.phase}" references skill "${skillName}" but ${skillPath} does not exist`)
          }
        }
      }
    }
  }

  // C7: Fast-lane constraint
  if (manifest.routing_decision === "fast_lane") {
    if (manifest.nodes.length !== 1) {
      errors.push(`[C7-FAST] routing_decision=fast_lane but nodes.length=${manifest.nodes.length} (must be 1)`)
    }
    if (manifest.edges.length !== 0) {
      errors.push(`[C7-FAST] routing_decision=fast_lane but edges.length=${manifest.edges.length} (must be 0)`)
    }
    if (manifest.levels.length !== 1) {
      errors.push(`[C7-FAST] routing_decision=fast_lane but levels.length=${manifest.levels.length} (must be 1)`)
    }
  }

  // C8: Coverage completeness — every requirement is satisfied by >=1 task node
  const satisfiedReqs = new Set<string>()
  for (const node of manifest.nodes) {
    if (node.node_type === "task") {
      for (const rid of node.satisfies) {
        satisfiedReqs.add(rid)
      }
    }
  }
  for (const req of manifest.requirements) {
    if (!satisfiedReqs.has(req.id)) {
      errors.push(`[C8-COVER] Requirement ${req.id} is not satisfied by any task node`)
    }
  }

  return { valid: errors.length === 0, errors }
}

interface ErrorObj {
  instancePath?: string
  message?: string
  params?: { allowedValues?: unknown[] }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: DEHYDRATOR MODULE
// Reads target_files, strips implementation bodies for tier 1/2,
// provides full content for tier 3, generates diffs for diff tier.
// Enforces context_budget.max_tokens per phase.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estimate token count for a string. Uses a heuristic of ~4 chars per token.
 * This is intentionally conservative — better to overestimate than underestimate.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Read a file and return its full content. Returns empty string if file doesn't exist.
 */
function readFileContent(filePath: string): string {
  try {
    return readFileSync(filePath, "utf-8")
  } catch {
    return `[FILE NOT FOUND: ${filePath}]`
  }
}

/**
 * Strip comments from TypeScript/JavaScript code.
 * Removes // line comments, /* block comments, and /** JSDoc comments.
 */
function stripComments(code: string): string {
  return code
    .replace(/\/\*\*?[\s\S]*?\*\//g, "")   // block + jsdoc
    .replace(/\/\/.*$/gm, "")               // line comments
    .replace(/\n{3,}/g, "\n\n")             // collapse multiple blank lines
    .trim()
}

/**
 * Dehydrate to Tier 1: export names + signatures only (≤1K tokens).
 * Strips all implementation bodies, keeping only function/class/type
 * declarations with their signatures.
 */
function dehydrateTier1(code: string): string {
  const stripped = stripComments(code)
  const lines = stripped.split("\n")
  const result: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Keep: import/export statements, type/interface declarations, function signatures
    if (
      /^(import |export |export type |export interface |export class |export function |export const |export abstract |type |interface |class |function |const |abstract )/.test(trimmed) ||
      /^(import\{|export\{)/.test(trimmed)
    ) {
      // For function/class declarations, strip the body
      const bodyless = trimmed.replace(/\{[\s\S]*\}/g, "{ ... }")
      result.push(bodyless)
    }
  }

  return result.join("\n")
}

/**
 * Dehydrate to Tier 2: Tier 1 + type interface bodies + import graph (≤2K tokens).
 * Includes full type/interface definitions but strips function implementation bodies.
 */
function dehydrateTier2(code: string): string {
  const stripped = stripComments(code)
  const lines = stripped.split("\n")
  const result: string[] = []
  let inTypeBlock = false
  let braceDepth = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Track type/interface blocks — include their full body
    if (/^(export )?(type|interface) /.test(trimmed)) {
      inTypeBlock = true
      braceDepth = (trimmed.match(/\{/g) || []).length - (trimmed.match(/\}/g) || []).length
      result.push(line)
      continue
    }

    if (inTypeBlock) {
      braceDepth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length
      result.push(line)
      if (braceDepth <= 0) {
        inTypeBlock = false
      }
      continue
    }

    // Keep imports and signatures (no bodies)
    if (
      /^(import |export type |export interface |export class |export function |export const )/.test(trimmed) ||
      /^(type |interface |class |function |const )/.test(trimmed)
    ) {
      const bodyless = line.replace(/\{[\s\S]*\}/g, "{ ... }")
      result.push(bodyless)
    }
  }

  return result.join("\n")
}

/**
 * Dehydrate to Tier 3: full file content (≤4K token sandbox).
 * Strips comments but keeps all implementation bodies.
 */
function dehydrateTier3(code: string): string {
  return stripComments(code)
}

/**
 * Dehydrate context for a specific phase based on its context_tier.
 * Reads the node's target_files and applies the appropriate dehydration level.
 * Enforces the node's context_budget.max_tokens limit.
 */
function dehydrateContext(
  node: ManifestNode,
  phase: Phase,
  worktree: string,
  diffs?: FileDiff[],
  dependencyFiles?: string[],
): string {
  if (phase.context_tier === undefined) return ""
  if (phase.context_tier === "diff") {
    if (!diffs || diffs.length === 0) {
      return "[No diffs available yet — read target_files directly to inspect current state]"
    }
    const parts: string[] = []
    for (const diff of diffs) {
      parts.push(`### ${diff.file} (+${diff.additions} -${diff.deletions})`)
      parts.push("```diff")
      const beforeLines = diff.before.split("\n")
      const afterLines = diff.after.split("\n")
      const maxLines = Math.max(beforeLines.length, afterLines.length)
      for (let i = 0; i < maxLines; i++) {
        const b = beforeLines[i] ?? ""
        const a = afterLines[i] ?? ""
        if (b !== a) {
          if (b) parts.push(`- ${b}`)
          if (a) parts.push(`+ ${a}`)
        } else if (a) {
          parts.push(`  ${a}`)
        }
      }
      parts.push("```")
      parts.push("")
    }
    return parts.join("\n")
  }

  const parts: string[] = []
  let totalTokens = 0
  const maxTokens = node.context_budget.max_tokens

  // Dehydrate target_files at the phase's declared tier
  for (const relPath of node.target_files) {
    const absPath = resolve(worktree, relPath)
    const content = readFileContent(absPath)
    let dehydrated: string

    switch (phase.context_tier) {
      case 1:
        dehydrated = dehydrateTier1(content)
        break
      case 2:
        dehydrated = dehydrateTier2(content)
        break
      case 3:
        dehydrated = dehydrateTier3(content)
        break
      default:
        dehydrated = content
    }

    const tokens = estimateTokens(dehydrated)
    if (totalTokens + tokens > maxTokens) {
      // Truncate to fit budget
      const remaining = maxTokens - totalTokens
      if (remaining <= 0) break
      const charBudget = remaining * 4
      dehydrated = dehydrated.slice(0, charBudget) + "\n... [TRUNCATED — context budget reached]"
      parts.push(`### ${relPath} (tier ${phase.context_tier}, truncated)`)
    } else {
      parts.push(`### ${relPath} (tier ${phase.context_tier})`)
    }
    parts.push("```")
    parts.push(dehydrated)
    parts.push("```")
    parts.push("")
    totalTokens += estimateTokens(dehydrated)
  }

  // Dehydrate dependency files at tier 1 (signatures only) for discover/architect phases
  // This gives the architect visibility into upstream dependencies declared via edges
  if (dependencyFiles && dependencyFiles.length > 0 && (phase.phase === "discover" || phase.phase === "architect")) {
    parts.push("### Dependency Files (tier 1 — signatures only)")
    for (const relPath of dependencyFiles) {
      if (node.target_files.includes(relPath)) continue // already dehydrated above
      const absPath = resolve(worktree, relPath)
      const content = readFileContent(absPath)
      const dehydrated = dehydrateTier1(content)
      const tokens = estimateTokens(dehydrated)
      if (totalTokens + tokens > maxTokens) break
      parts.push(`#### ${relPath}`)
      parts.push("```")
      parts.push(dehydrated)
      parts.push("```")
      parts.push("")
      totalTokens += tokens
    }
  }

  return parts.join("\n")
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: SKILL LOADER
// Reads skills/<name>/SKILL.md and returns the content for injection.
// ═══════════════════════════════════════════════════════════════════════════

const _skillCache = new Map<string, string>()

function loadSkill(skillName: string, skillsDir: string): string {
  if (_skillCache.has(skillName)) return _skillCache.get(skillName)!
  const skillPath = join(skillsDir, skillName, "SKILL.md")
  try {
    const content = readFileSync(skillPath, "utf-8")
    _skillCache.set(skillName, content)
    return content
  } catch {
    return `[SKILL NOT FOUND: ${skillName}]`
  }
}

/**
 * Build the Injected Skills section of the Engine Payload by reading
 * each skill's SKILL.md file and formatting it into the payload.
 */
function buildSkillsSection(skills: string[], skillsDir: string): string {
  if (!skills || skills.length === 0) return "[No skills injected for this phase]"
  const parts: string[] = ["### Injected Skills"]
  for (const name of skills) {
    const content = loadSkill(name, skillsDir)
    parts.push(`### Skill: ${name}`)
    parts.push(content)
    parts.push("")
  }
  return parts.join("\n")
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: MECHANICAL GATES
// Pure TypeScript deterministic gates — no LLM involvement.
// ═══════════════════════════════════════════════════════════════════════════

// ─── 5a: Edge-Judge ────────────────────────────────────────────────────────
// Runs tsc/eslint on modified files + heuristic data-hollowing/scope-escape.

function runEdgeJudge(
  node: ManifestNode,
  diffs: FileDiff[],
  worktree: string,
): { verdict: "APPROVED" | "REJECTED"; fault_vector: FaultVector } {
  const checks = {
    syntax_compliance: "PASS" as "PASS" | "FAIL",
    data_hollowing: "PASS" as "PASS" | "FAIL",
    scope_escape: "PASS" as "PASS" | "FAIL",
  }

  let anomaly_type: FaultVector["anomaly_type"] = "NONE"
  let description = ""

  // ── Check 1: STATIC SYNTAX COMPLIANCE (P0) ──────────────────────────────
  if (node.language === "typescript" || node.language === "javascript") {
    for (const diff of diffs) {
      const absPath = resolve(worktree, diff.file)
      if (!existsSync(absPath)) continue

      // Run tsc --noEmit on the specific file
      try {
        execSync(`npx tsc --noEmit --pretty false "${absPath}" 2>&1`, {
          cwd: worktree,
          timeout: 30000,
          stdio: "pipe",
          encoding: "utf-8",
        })
      } catch (e: unknown) {
        const output = (e as { stdout?: string; stderr?: string }).stdout || (e as { stderr?: string }).stderr || String(e)
        // Filter out "file not found in project" errors that aren't syntax errors
        if (!output.includes("could not find") && !output.includes("Cannot find project")) {
          checks.syntax_compliance = "FAIL"
          anomaly_type = "SYNTAX_ERROR"
          description = `tsc --noEmit failed on ${diff.file}: ${output.slice(0, 500)}`
          break
        }
      }

      // Run eslint on the specific file
      try {
        execSync(`npx eslint --no-error-on-unmatched-pattern "${absPath}" 2>&1`, {
          cwd: worktree,
          timeout: 30000,
          stdio: "pipe",
          encoding: "utf-8",
        })
      } catch (e: unknown) {
        const output = (e as { stdout?: string; stderr?: string }).stdout || (e as { stderr?: string }).stderr || String(e)
        if (output.includes("error") && !output.includes("warning")) {
          checks.syntax_compliance = "FAIL"
          if (anomaly_type === "NONE") anomaly_type = "SYNTAX_ERROR"
          description = `eslint failed on ${diff.file}: ${output.slice(0, 500)}`
          break
        }
      }
    }
  }

  if (checks.syntax_compliance === "FAIL") {
    return {
      verdict: "REJECTED",
      fault_vector: {
        severity: "CRITICAL",
        anomaly_type,
        description,
        checks_run: checks,
      },
    }
  }

  // ── Check 2: SCOPE_ESCAPE ───────────────────────────────────────────────
  for (const diff of diffs) {
    // Check if diff.file is in target_files
    const isInScope = node.target_files.includes(diff.file) ||
      node.target_files.some((tf) => resolve(worktree, tf) === resolve(worktree, diff.file))
    if (!isInScope) {
      checks.scope_escape = "FAIL"
      anomaly_type = "SCOPE_ESCAPE"
      description = `File "${diff.file}" was modified but is not in target_files: ${JSON.stringify(node.target_files)}`
      break
    }

    // Check line ranges if scope_lines is declared
    if (node.scope_lines && node.scope_lines.length > 0) {
      const scopeForFile = node.scope_lines.filter((s) => s.file === diff.file)
      if (scopeForFile.length > 0) {
        // Parse diff to find changed line numbers
        const changedLines = parseDiffLineNumbers(diff.after)
        for (const line of changedLines) {
          const inRange = scopeForFile.some((s) => line >= s.start && line <= s.end)
          if (!inRange) {
            checks.scope_escape = "FAIL"
            anomaly_type = "SCOPE_ESCAPE"
            description = `Line ${line} in "${diff.file}" is outside declared scope_lines: ${JSON.stringify(scopeForFile)}`
            break
          }
        }
        if (checks.scope_escape === "FAIL") break
      }
    }
  }

  if (checks.scope_escape === "FAIL") {
    return {
      verdict: "REJECTED",
      fault_vector: {
        severity: "CRITICAL",
        anomaly_type,
        description,
        checks_run: checks,
      },
    }
  }

  // ── Check 3: DATA_HOLLOWING ─────────────────────────────────────────────
  for (const diff of diffs) {
    const afterLines = diff.after.split("\n")
    const beforeLines = diff.before.split("\n")

    // Line count drop > 40% in a single file
    if (beforeLines.length > 10 && afterLines.length < beforeLines.length * 0.6) {
      checks.data_hollowing = "FAIL"
      anomaly_type = "DATA_HOLLOWING"
      description = `File "${diff.file}" line count dropped from ${beforeLines.length} to ${afterLines.length} (>40% reduction — possible data hollowing)`
      break
    }

    // Function body replaced with TODO or placeholder
    if (/\/\/\s*(TODO|FIXME|\.\.\.)/.test(diff.after) && !/\/\/\s*(TODO|FIXME|\.\.\.)/.test(diff.before)) {
      const placeholderCount = (diff.after.match(/\/\/\s*(TODO|FIXME|\.\.\.)/g) || []).length
      if (placeholderCount > 2) {
        checks.data_hollowing = "FAIL"
        anomaly_type = "DATA_HOLLOWING"
        description = `File "${diff.file}" contains ${placeholderCount} new TODO/placeholder comments — possible data hollowing`
        break
      }
    }

    // Unmatched braces
    const openBraces = (diff.after.match(/\{/g) || []).length
    const closeBraces = (diff.after.match(/\}/g) || []).length
    if (Math.abs(openBraces - closeBraces) > 2) {
      checks.data_hollowing = "FAIL"
      anomaly_type = "DATA_HOLLOWING"
      description = `File "${diff.file}" has unmatched braces: ${openBraces} open vs ${closeBraces} close`
      break
    }
  }

  if (checks.data_hollowing === "FAIL") {
    return {
      verdict: "REJECTED",
      fault_vector: {
        severity: "CRITICAL",
        anomaly_type,
        description,
        checks_run: checks,
      },
    }
  }

  // ── All checks passed ───────────────────────────────────────────────────
  return {
    verdict: "APPROVED",
    fault_vector: {
      severity: "NONE",
      anomaly_type: "NONE",
      description: "",
      checks_run: checks,
    },
  }
}

/**
 * Parse line numbers from the "after" content of a diff.
 * Returns the line numbers that contain actual code (non-empty, non-comment).
 */
function parseDiffLineNumbers(after: string): number[] {
  const lines = after.split("\n")
  const numbers: number[] = []
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (trimmed && !trimmed.startsWith("//") && !trimmed.startsWith("/*")) {
      numbers.push(i + 1)
    }
  }
  return numbers
}

// ─── 5b: AST-Aggregator ───────────────────────────────────────────────────
// Deterministic diff merging + collision detection.

function runASTAggregator(
  nodeResults: NodeResult[],
  manifest: Manifest,
): ASTAggregatorResult {
  const allDiffs: Array<{ node_id: string; diff: FileDiff }> = []
  for (const nr of nodeResults) {
    if (nr.status === "APPROVED") {
      for (const diff of nr.final_diffs) {
        allDiffs.push({ node_id: nr.node_id, diff })
      }
    }
  }

  const collisions: Collision[] = []
  const isolatedLanes: string[] = []

  // Build a map: file → list of (node_id, diff)
  const fileDiffs = new Map<string, Array<{ node_id: string; diff: FileDiff }>>()
  for (const entry of allDiffs) {
    const key = entry.diff.file
    if (!fileDiffs.has(key)) fileDiffs.set(key, [])
    fileDiffs.get(key)!.push(entry)
  }

  // Detect LINE_OVERLAP: same file modified by multiple nodes
  for (const [file, entries] of fileDiffs) {
    if (entries.length > 1) {
      // Check if the nodes have a declared dependency (edge) — if so, ordering is expected
      const nodeIds = entries.map((e) => e.node_id)
      const hasEdge = manifest.edges.some(
        (e) => nodeIds.includes(e.from) && nodeIds.includes(e.to),
      )
      if (!hasEdge) {
        collisions.push({
          class: "LINE_OVERLAP",
          patches_involved: nodeIds,
          file,
          lines: "multiple",
          resolution: "UNRESOLVABLE — multiple nodes modified same file without declared dependency",
        })
        for (const nid of nodeIds) {
          if (!isolatedLanes.includes(nid)) isolatedLanes.push(nid)
        }
      }
    }
  }

  // Detect IMPORT_CONFLICT: node A removes an import that node B references
  for (let i = 0; i < nodeResults.length; i++) {
    for (let j = i + 1; j < nodeResults.length; j++) {
      const a = nodeResults[i]
      const b = nodeResults[j]
      const aNode = manifest.nodes.find((n) => n.id === a.node_id)
      const bNode = manifest.nodes.find((n) => n.id === b.node_id)
      if (!aNode?.imports_delta || !bNode?.imports_delta) continue

      // Check if A removes something B adds
      const aRemoved = new Set(aNode.imports_delta.removed)
      const bAdded = bNode.imports_delta.added
      for (const imp of bAdded) {
        if (aRemoved.has(imp)) {
          collisions.push({
            class: "IMPORT_CONFLICT",
            patches_involved: [a.node_id, b.node_id],
            file: "",
            resolution: "UNRESOLVABLE — node B adds import that node A removes",
          })
        }
      }
    }
  }

  // Detect SIGNATURE_DIVERGENCE: node A changes an export that node B calls
  for (let i = 0; i < nodeResults.length; i++) {
    for (let j = i + 1; j < nodeResults.length; j++) {
      const a = nodeResults[i]
      const b = nodeResults[j]
      const aNode = manifest.nodes.find((n) => n.id === a.node_id)
      const bNode = manifest.nodes.find((n) => n.id === b.node_id)
      if (!aNode?.exports_delta || !bNode?.imports_delta) continue

      const aChangedExports = new Set([
        ...aNode.exports_delta.added,
        ...aNode.exports_delta.removed,
      ])
      for (const imp of bNode.imports_delta.added) {
        for (const exp of aChangedExports) {
          if (imp.includes(exp) || exp.includes(imp)) {
            collisions.push({
              class: "SIGNATURE_DIVERGENCE",
              patches_involved: [a.node_id, b.node_id],
              file: "",
              resolution: "UNRESOLVABLE — node B imports a symbol whose export was changed by node A",
            })
          }
        }
      }
    }
  }

  // Build consolidated diffs (merge non-conflicting patches)
  const consolidated: FileDiff[] = []
  for (const [file, entries] of fileDiffs) {
    if (entries.length === 1) {
      consolidated.push(entries[0].diff)
    } else {
      // Multiple nodes touched same file — if no collision, merge by taking the last version
      const hasCollision = collisions.some((c) => c.file === file && c.resolution.startsWith("UNRESOLVABLE"))
      if (!hasCollision) {
        // Sort by topological order (earlier levels first)
        const sorted = entries.sort((a, b) => {
          const aLevel = manifest.levels.findIndex((lvl) => lvl.includes(a.node_id))
          const bLevel = manifest.levels.findIndex((lvl) => lvl.includes(b.node_id))
          return aLevel - bLevel
        })
        // Take the last version (most recent modification)
        consolidated.push(sorted[sorted.length - 1].diff)
      }
    }
  }

  const hasUnresolvable = collisions.some((c) => c.resolution.startsWith("UNRESOLVABLE"))
  return {
    merge_status: hasUnresolvable ? "PARTIAL_CONFLICT" : "SUCCESS",
    consolidated_diffs: consolidated,
    collisions,
    isolated_lanes: isolatedLanes,
  }
}

// ─── 5c: Global-Judge ─────────────────────────────────────────────────────
// Deterministic coverage map: requirements ↔ node.satisfies ↔ diffs.

function runGlobalJudge(
  manifest: Manifest,
  allResults: LevelResult[],
): GlobalJudgeResult {
  // Collect all APPROVED diffs across all levels
  const allDiffs: FileDiff[] = []
  for (const level of allResults) {
    if (level.ast_aggregator_result) {
      allDiffs.push(...level.ast_aggregator_result.consolidated_diffs)
    } else {
      for (const nr of level.node_results) {
        if (nr.status === "APPROVED") {
          allDiffs.push(...nr.final_diffs)
        }
      }
    }
  }

  const touchedFiles = new Set(allDiffs.map((d) => d.file))

  // ── Step 1: Requirements-Mutation Cross-Reference ───────────────────────
  const missingDetail: string[] = []
  let covered = 0

  for (const req of manifest.requirements) {
    // Find nodes that satisfy this requirement
    const satisfyingNodes = manifest.nodes.filter(
      (n) => n.node_type === "task" && n.satisfies.includes(req.id),
    )

    if (satisfyingNodes.length === 0) {
      missingDetail.push(`${req.id}: no task node satisfies this requirement`)
      continue
    }

    // Check if any satisfying node has APPROVED diffs touching acceptance_files
    let reqCovered = false
    for (const node of satisfyingNodes) {
      const nodeResult = allResults
        .flatMap((l) => l.node_results)
        .find((nr) => nr.node_id === node.id)

      if (nodeResult?.status === "APPROVED") {
        const nodeTouchedFiles = new Set(nodeResult.final_diffs.map((d) => d.file))
        const touchesAcceptance = req.acceptance_files.some((f) =>
          nodeTouchedFiles.has(f) || nodeTouchedFiles.has(resolve("/", f).slice(1)),
        )
        if (touchesAcceptance) {
          reqCovered = true
          break
        }
      }
    }

    if (reqCovered) {
      covered++
    } else {
      missingDetail.push(
        `${req.id}: satisfying nodes exist but none have APPROVED diffs touching acceptance_files ${JSON.stringify(req.acceptance_files)}`,
      )
    }
  }

  const total = manifest.requirements.length
  const missing = total - covered

  // ── Step 2: Mutation Integrity ──────────────────────────────────────────
  // Count mutations (diffs) and classify them
  const allNodeIds = new Set(manifest.nodes.map((n) => n.id))
  let justified = 0
  let unplanned = 0

  for (const diff of allDiffs) {
    // A diff is justified if it touches a file declared in some node's output_files
    const isJustified = manifest.nodes.some(
      (n) =>
        n.output_files?.includes(diff.file) ||
        n.target_files.includes(diff.file),
    )
    if (isJustified) {
      justified++
    } else {
      // Check if it's a derived side-effect (file in same directory as a target_file)
      const isDerived = manifest.nodes.some((n) =>
        n.target_files.some((tf) => dirname(tf) === dirname(diff.file)),
      )
      if (isDerived) {
        justified++ // derived counts as justified
      } else {
        unplanned++
      }
    }
  }

  // ── Step 3: Regression Vector Scan ──────────────────────────────────────
  const regressionVectors: Array<{ file: string; symbol: string; severity: string }> = []
  for (const node of manifest.nodes) {
    if (!node.touches_symbols) continue
    const nodeResult = allResults
      .flatMap((l) => l.node_results)
      .find((nr) => nr.node_id === node.id)
    if (nodeResult?.status !== "APPROVED") continue

    for (const symbol of node.touches_symbols) {
      // Check if any file NOT in target_files depends on this symbol
      // This is a heuristic — a real implementation would use the import graph
      for (const diff of allDiffs) {
        if (node.target_files.includes(diff.file)) continue
        if (diff.after.includes(symbol) && !diff.before.includes(symbol)) {
          // This file now references the symbol but wasn't supposed to be touched
          // Only flag if it's a new reference (not just the symbol appearing in unrelated code)
          regressionVectors.push({
            file: diff.file,
            symbol,
            severity: "MEDIUM",
          })
        }
      }
    }
  }

  // ── Step 4: Integrity Score ─────────────────────────────────────────────
  const corrupted = 0
  const score =
    total > 0
      ? (covered / total) * 100 -
        missing * 25 -
        corrupted * 50 -
        unplanned * 10 -
        regressionVectors.length * 30
      : 100

  const integrityScore = Math.max(0, Math.min(100, Math.round(score)))

  let integrityLevel: GlobalJudgeResult["integrity_level"]
  if (integrityScore >= 90) integrityLevel = "FULL_INTEGRITY"
  else if (integrityScore >= 70) integrityLevel = "MINOR_GAPS"
  else if (integrityScore >= 50) integrityLevel = "SIGNIFICANT_GAPS"
  else integrityLevel = "CORRUPTED"

  let verdict: GlobalJudgeResult["verdict"]
  if (integrityScore >= 90 && missing === 0 && regressionVectors.length === 0) {
    verdict = "APPROVED"
  } else if (integrityScore >= 70 && missing === 0) {
    verdict = "APPROVED_WITH_NOTES"
  } else {
    verdict = "NEEDS_REMEDIATION"
  }

  return {
    verdict,
    integrity_score: integrityScore,
    integrity_level: integrityLevel,
    coverage: { total, covered, missing, missing_detail: missingDetail },
    mutations: {
      total: allDiffs.length,
      justified,
      derived: 0,
      unplanned,
      corrupted,
    },
    regression_vectors: regressionVectors,
    ready_for_workspace: verdict !== "NEEDS_REMEDIATION",
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6: SPAWN BRIDGE
// Dispatches generic LLM agents via the opencode SDK.
// Iterates levels[] with Promise.all() for true parallelism.
// ═══════════════════════════════════════════════════════════════════════════

interface SpawnBridgeContext {
  client: PluginInput["client"]
  worktree: string
  directory: string
  skillsDir: string
  parentSessionId: string
}

/**
 * Build the Engine Payload string for a specific node + phase.
 * This is the text that gets sent to the generic LLM agent.
 */
function buildEnginePayload(
  node: ManifestNode,
  phase: Phase,
  ctx: SpawnBridgeContext,
  priorOutputs: PhaseOutput[],
  currentDiffs?: FileDiff[],
  allNodes?: ManifestNode[],
  edges?: Edge[],
): string {
  const parts: string[] = ["## Engine Payload", ""]

  // Task table
  parts.push("### Task")
  parts.push("| Field | Value |")
  parts.push("|---|---|")
  parts.push(`| node_id | ${node.id} |`)
  parts.push(`| domain | ${node.domain} |`)
  parts.push(`| concern | ${node.concern ?? "null"} |`)
  parts.push(`| target_files | ${JSON.stringify(node.target_files)} |`)
  if (node.scope_lines && node.scope_lines.length > 0) {
    parts.push(`| scope_lines | ${JSON.stringify(node.scope_lines)} |`)
  }
  parts.push(`| language | ${node.language} |`)
  parts.push(`| mutation | ${node.mutation} |`)
  if (node.output_files) {
    parts.push(`| output_files | ${JSON.stringify(node.output_files)} |`)
  }
  if (node.imports_delta) {
    parts.push(`| imports_delta | added: ${JSON.stringify(node.imports_delta.added)}, removed: ${JSON.stringify(node.imports_delta.removed)} |`)
  }
  if (node.exports_delta) {
    parts.push(`| exports_delta | added: ${JSON.stringify(node.exports_delta.added)}, removed: ${JSON.stringify(node.exports_delta.removed)} |`)
  }
  if (node.touches_symbols) {
    parts.push(`| touches_symbols | ${JSON.stringify(node.touches_symbols)} |`)
  }
  parts.push("")

  // Context (dehydrated)
  const tierLabel = phase.context_tier === "diff" ? "Diff" : `Tier ${phase.context_tier}`
  // Compute dependency files: files from upstream nodes (edges pointing TO this node)
  let dependencyFiles: string[] | undefined
  if (allNodes && edges && (phase.phase === "discover" || phase.phase === "architect")) {
    const incomingEdges = edges.filter((e) => e.to === node.id)
    const upstreamNodeIds = incomingEdges.map((e) => e.from)
    const upstreamNodes = allNodes.filter((n) => upstreamNodeIds.includes(n.id))
    dependencyFiles = upstreamNodes
      .flatMap((n) => n.output_files ?? n.target_files)
      .filter((f) => !node.target_files.includes(f))
    if (dependencyFiles.length === 0) dependencyFiles = undefined
  }
  const contextContent = dehydrateContext(node, phase, ctx.worktree, currentDiffs, dependencyFiles)
  parts.push(`### Context (${tierLabel})`)
  parts.push(contextContent)
  parts.push("")

  // Injected skills
  if (phase.skills && phase.skills.length > 0) {
    parts.push(buildSkillsSection(phase.skills, ctx.skillsDir))
  } else {
    parts.push("### Injected Skills")
    parts.push("[No skills injected for this phase]")
  }
  parts.push("")

  // Prior phase outputs — truncate older outputs to prevent context bloat
  if (priorOutputs.length > 0) {
    parts.push("### Prior Phase Outputs")
    // Keep the most recent 2 outputs at full length; truncate older ones to first 500 chars (tables + key findings)
    const recentCount = 2
    for (let idx = 0; idx < priorOutputs.length; idx++) {
      const po = priorOutputs[idx]
      const isRecent = idx >= priorOutputs.length - recentCount
      parts.push(`#### Phase: ${po.phase}${po.agent ? ` (${po.agent})` : ""}`)
      if (isRecent) {
        parts.push(po.text)
      } else {
        // Truncate older outputs — keep first 500 chars (usually contains the summary tables)
        const truncated = po.text.length > 500
          ? po.text.slice(0, 500) + "\n... [truncated — see full output in prior phase]"
          : po.text
        parts.push(truncated)
      }
      if (po.verdict) {
        parts.push(`Verifier verdict: ${po.verdict}`)
      }
      if (po.violations && po.violations.length > 0) {
        parts.push("Violations:")
        for (const v of po.violations) {
          parts.push(`- [${v.severity}] ${v.file}:${v.line} — ${v.rule} (skill: ${v.skill}) — ${v.evidence}`)
        }
      }
      if (po.fault_vector && po.fault_vector.anomaly_type !== "NONE") {
        parts.push(`Edge-Judge fault_vector: [${po.fault_vector.anomaly_type}] ${po.fault_vector.description}`)
      }
      parts.push("")
    }
  } else {
    parts.push("### Prior Phase Outputs")
    parts.push("[None — this is the first phase]")
  }
  parts.push("")

  return parts.join("\n")
}

/**
 * Extract text response from a session prompt response.
 * Filters parts for type="text" and concatenates the text.
 */
function extractTextFromParts(parts: Array<{ type: string; text?: string }>): string {
  return parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text!)
    .join("\n")
}

/**
 * Parse verifier JSON output to extract verdict and violations.
 */
function parseVerifierOutput(text: string): { verdict: "PASS" | "FAIL"; violations: VerifierViolation[] } {
  try {
    // Find JSON in the text (may be wrapped in markdown code block)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { verdict: "FAIL", violations: [] }
    const parsed = JSON.parse(jsonMatch[0])
    return {
      verdict: parsed.verdict === "PASS" ? "PASS" : "FAIL",
      violations: (parsed.violations || []).map((v: Record<string, unknown>) => ({
        file: String(v.file || ""),
        line: Number(v.line || 0),
        rule: String(v.rule || ""),
        skill: String(v.skill || ""),
        evidence: String(v.evidence || ""),
        severity: (v.severity === "BLOCKING" ? "BLOCKING" : "NON_BLOCKING") as "BLOCKING" | "NON_BLOCKING",
        confidence: (v.confidence === "HIGH" ? "HIGH" : v.confidence === "MEDIUM" ? "MEDIUM" : "LOW") as "HIGH" | "MEDIUM" | "LOW",
      })),
    }
  } catch {
    return { verdict: "FAIL", violations: [] }
  }
}

/**
 * Spawn a generic LLM agent for a single phase.
 * Creates a child session, sends the Engine Payload as a prompt, and returns the output.
 */
async function spawnAgent(
  node: ManifestNode,
  phase: Phase,
  ctx: SpawnBridgeContext,
  priorOutputs: PhaseOutput[],
  currentDiffs?: FileDiff[],
  allNodes?: ManifestNode[],
  edges?: Edge[],
): Promise<PhaseOutput> {
  if (!phase.agent) throw new Error(`Phase ${phase.phase} on node ${node.id} has type=llm but no agent declared`)

  const payload = buildEnginePayload(node, phase, ctx, priorOutputs, currentDiffs, allNodes, edges)

  // Create a child session for this agent
  const sessionResult = await ctx.client.session.create({
    body: {
      parentID: ctx.parentSessionId,
      title: `${node.id}-${phase.phase}`,
    },
  })
  const sessionId = (sessionResult as { data?: { id?: string }; id?: string }).data?.id || (sessionResult as { id?: string }).id || ""
  if (!sessionId) throw new Error(`Failed to create session for ${node.id}-${phase.phase}`)

  // Send the payload as a prompt to the specified agent
  const promptResult = await ctx.client.session.prompt({
    body: {
      agent: phase.agent,
      parts: [{ type: "text", text: payload }],
    },
    path: { id: sessionId },
  })

  // Extract text from the response
  const responseParts = (promptResult as { data?: { parts?: Array<{ type: string; text?: string }> }; parts?: Array<{ type: string; text?: string }> }).data?.parts || (promptResult as { parts?: Array<{ type: string; text?: string }> }).parts || []
  const text = extractTextFromParts(responseParts)

  // Get the session diff (for implementer/fixer phases that modify files)
  let diffs: FileDiff[] = []
  if (phase.phase === "implement" || phase.phase === "fix") {
    try {
      const diffResult = await ctx.client.session.diff({
        path: { id: sessionId },
      })
      diffs = (diffResult as { data?: FileDiff[] }).data || (diffResult as FileDiff[]) || []
    } catch {
      // Diff may not be available if no files were changed
    }
  }

  // Parse verifier output if this is a verify phase
  let verdict: "PASS" | "FAIL" | undefined
  let violations: VerifierViolation[] | undefined
  if (phase.phase === "verify") {
    const parsed = parseVerifierOutput(text)
    verdict = parsed.verdict
    violations = parsed.violations
  }

  return {
    phase: phase.phase,
    agent: phase.agent,
    text,
    diffs,
    verdict,
    violations,
    session_id: sessionId,
  }
}

/**
 * Execute the full phase_chain for a single node.
 * Handles conditional phases (on_verify_fail) and the retry_budget loop.
 */
async function executeNode(
  node: ManifestNode,
  ctx: SpawnBridgeContext,
  allNodes?: ManifestNode[],
  edges?: Edge[],
): Promise<NodeResult> {
  const phaseOutputs: PhaseOutput[] = []
  let finalDiffs: FileDiff[] = []
  let respinsUsed = 0
  let edgeJudgeVerdict: "APPROVED" | "REJECTED" = "APPROVED"
  let faultVector: FaultVector | undefined

  for (let i = 0; i < node.phase_chain.length; i++) {
    const phase = node.phase_chain[i]

    // Check conditional — skip if on_verify_fail and verify passed
    if (phase.conditional === "on_verify_fail") {
      const verifyOutput = phaseOutputs.find((po) => po.phase === "verify")
      if (verifyOutput && verifyOutput.verdict === "PASS") {
        continue // Skip fix phase — verify passed
      }
    }

    if (phase.type === "mechanical") {
      // ── Mechanical gate (edge-judge) ─────────────────────────────────────
      if (phase.gate === "edge-judge") {
        const result = runEdgeJudge(node, finalDiffs, ctx.worktree)
        edgeJudgeVerdict = result.verdict
        faultVector = result.fault_vector

        phaseOutputs.push({
          phase: "gate",
          text: JSON.stringify(result, null, 2),
          fault_vector: result.fault_vector,
        })

        if (result.verdict === "REJECTED" && respinsUsed < node.retry_budget.max_respins) {
          // Re-spin: find the fix phase and re-run it with the fault_vector
          respinsUsed++
          const fixPhase = node.phase_chain.find((p) => p.phase === "fix")
          if (fixPhase && fixPhase.type === "llm" && fixPhase.agent) {
            // Add the fault_vector to prior outputs so the fixer sees it
            const fixOutput = await spawnAgent(node, fixPhase, ctx, [...phaseOutputs], finalDiffs, allNodes, edges)
            phaseOutputs.push(fixOutput)
            if (fixOutput.diffs.length > 0) {
              finalDiffs = fixOutput.diffs
            }
            // Re-run verify after fix to catch semantic regressions
            const verifyPhase = node.phase_chain.find((p) => p.phase === "verify" && p.type === "llm")
            if (verifyPhase && verifyPhase.agent) {
              const reverifyOutput = await spawnAgent(node, verifyPhase, ctx, [...phaseOutputs], finalDiffs, allNodes, edges)
              phaseOutputs.push(reverifyOutput)
            }
            // Re-run the gate
            const rejudge = runEdgeJudge(node, finalDiffs, ctx.worktree)
            edgeJudgeVerdict = rejudge.verdict
            faultVector = rejudge.fault_vector
            phaseOutputs.push({
              phase: "gate",
              text: JSON.stringify(rejudge, null, 2),
              fault_vector: rejudge.fault_vector,
            })
            if (rejudge.verdict === "REJECTED" && respinsUsed >= node.retry_budget.max_respins) {
              return {
                node_id: node.id,
                status: "UNRESOLVABLE_ANOMALY",
                phases: phaseOutputs,
                final_diffs: finalDiffs,
                edge_judge_verdict: "REJECTED",
                respins_used: respinsUsed,
                fault_vector: rejudge.fault_vector,
              }
            }
          }
        } else if (result.verdict === "REJECTED" && respinsUsed >= node.retry_budget.max_respins) {
          return {
            node_id: node.id,
            status: "UNRESOLVABLE_ANOMALY",
            phases: phaseOutputs,
            final_diffs: finalDiffs,
            edge_judge_verdict: "REJECTED",
            respins_used: respinsUsed,
            fault_vector: result.fault_vector,
          }
        }
      }
    } else {
      // ── LLM agent phase ──────────────────────────────────────────────────
      const output = await spawnAgent(node, phase, ctx, [...phaseOutputs], finalDiffs, allNodes, edges)
      phaseOutputs.push(output)

      // Update final diffs from implementer/fixer output
      if (output.diffs && output.diffs.length > 0) {
        finalDiffs = output.diffs
      }
    }
  }

  // Determine final status
  const status: NodeResult["status"] =
    edgeJudgeVerdict === "APPROVED" ? "APPROVED" : "REJECTED"

  return {
    node_id: node.id,
    status,
    phases: phaseOutputs,
    final_diffs: finalDiffs,
    edge_judge_verdict: edgeJudgeVerdict,
    respins_used: respinsUsed,
    fault_vector: faultVector,
  }
}

/**
 * Execute all nodes in a single topological level in parallel.
 * Uses Promise.all() for true parallelism — all independent nodes spawn simultaneously.
 */
async function executeLevel(
  levelIndex: number,
  nodeIds: string[],
  manifest: Manifest,
  ctx: SpawnBridgeContext,
): Promise<LevelResult> {
  const nodes = nodeIds
    .map((id) => manifest.nodes.find((n) => n.id === id))
    .filter((n): n is ManifestNode => n !== undefined)

  // ── Spawn ALL nodes in this level in parallel ───────────────────────────
  const nodeResults = await Promise.all(
    nodes.map((node) => executeNode(node, ctx, manifest.nodes, manifest.edges)),
  )

  // ── Run AST Aggregator after the level if enabled ───────────────────────
  let astResult: ASTAggregatorResult | undefined
  if (manifest.gates.per_level.ast_aggregator && nodeResults.length > 0) {
    astResult = runASTAggregator(nodeResults, manifest)
  }

  return {
    level_index: levelIndex,
    node_results: nodeResults,
    ast_aggregator_result: astResult,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7: ENGINE ORCHESTRATOR
// Top-level: validate → iterate levels → gates → HITL payload.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Write run artifacts to the local workspace for audit/debugging.
 * All artifacts go to ./.opencode/runs/<workflow_id>/ relative to the worktree.
 * This is the ONLY function in the engine that writes to disk.
 * The global ~/.config/opencode/ directory is never written to.
 */
function writeRunArtifacts(
  result: EngineResult,
  levelResults: LevelResult[],
  worktree: string,
): void {
  const runDir = resolve(worktree, ".opencode", "runs", result.workflow_id)
  try {
    mkdirSync(runDir, { recursive: true })
  } catch {
    // Directory may already exist or worktree is not writable — skip artifacts
    return
  }

  // Write the full EngineResult JSON
  try {
    writeFileSync(
      join(runDir, "engine-result.json"),
      JSON.stringify(result, null, 2),
      "utf-8",
    )
  } catch { /* ignore write errors — artifacts are best-effort */ }

  // Write per-level node results and diffs
  for (const level of levelResults) {
    const levelDir = join(runDir, `level-${level.level_index}`)
    try {
      mkdirSync(levelDir, { recursive: true })
    } catch { continue }

    for (const nr of level.node_results) {
      try {
        writeFileSync(
          join(levelDir, `${nr.node_id}-result.json`),
          JSON.stringify({
            node_id: nr.node_id,
            status: nr.status,
            edge_judge_verdict: nr.edge_judge_verdict,
            respins_used: nr.respins_used,
            fault_vector: nr.fault_vector,
            final_diffs: nr.final_diffs,
            phases: nr.phases.map((p) => ({
              phase: p.phase,
              agent: p.agent,
              verdict: p.verdict,
              session_id: p.session_id,
              text_preview: p.text.slice(0, 500),
            })),
          }, null, 2),
          "utf-8",
        )
      } catch { /* ignore */ }
    }

    // Write AST aggregator result if present
    if (level.ast_aggregator_result) {
      try {
        writeFileSync(
          join(levelDir, "ast-aggregator-result.json"),
          JSON.stringify(level.ast_aggregator_result, null, 2),
          "utf-8",
        )
      } catch { /* ignore */ }
    }
  }

  // Write global judge result if present
  if (result.global_judge_result) {
    try {
      writeFileSync(
        join(runDir, "global-judge-result.json"),
        JSON.stringify(result.global_judge_result, null, 2),
        "utf-8",
      )
    } catch { /* ignore */ }
  }

  // Write HITL payload
  try {
    writeFileSync(
      join(runDir, "hitl-payload.json"),
      JSON.stringify(result.hitl_payload, null, 2),
      "utf-8",
    )
  } catch { /* ignore */ }
}

/**
 * Main engine entry point. Validates the manifest, executes all levels,
 * runs terminal gates, and assembles the HITL payload.
 */
async function runManifest(
  manifestPath: string,
  ctx: SpawnBridgeContext,
): Promise<EngineResult> {
  // ── Step 1: Load and parse manifest ─────────────────────────────────────
  const rawManifest = readFileSync(resolve(manifestPath), "utf-8")
  const manifest: Manifest = JSON.parse(rawManifest)

  // ── Step 2: Validate manifest ───────────────────────────────────────────
  const validation = validateManifest(manifest, ctx.skillsDir)
  if (!validation.valid) {
    return {
      workflow_id: manifest.workflow_id || "unknown",
      routing_decision: manifest.routing_decision || "full_dag",
      levels: [],
      hitl_payload: {
        workflow_id: manifest.workflow_id || "unknown",
        summary: "Manifest validation failed — execution aborted",
        proposed_changes: [],
        integrity_score: 0,
        global_judge_verdict: "VALIDATION_FAILED",
        blocking_issues: validation.errors,
        status: "BLOCKED",
      },
      status: "BLOCKED",
    }
  }

  // ── Step 3: Execute all levels sequentially ─────────────────────────────
  const levelResults: LevelResult[] = []
  for (let i = 0; i < manifest.levels.length; i++) {
    const levelResult = await executeLevel(i, manifest.levels[i], manifest, ctx)
    levelResults.push(levelResult)

    // Check for UNRESOLVABLE_ANOMALY — escalate
    const hasUnresolvable = levelResult.node_results.some(
      (nr) => nr.status === "UNRESOLVABLE_ANOMALY",
    )
    if (hasUnresolvable) {
      const escalated = assembleResult(manifest, levelResults, "ESCALATED")
      writeRunArtifacts(escalated, levelResults, ctx.worktree)
      return escalated
    }
  }

  // ── Step 4: Run terminal Global-Judge ───────────────────────────────────
  let globalJudgeResult: GlobalJudgeResult | undefined
  if (manifest.gates.terminal.global_judge) {
    globalJudgeResult = runGlobalJudge(manifest, levelResults)
  }

  // ── Step 5: Assemble result + HITL payload ──────────────────────────────
  const status: EngineResult["status"] =
    globalJudgeResult?.verdict === "NEEDS_REMEDIATION" ? "BLOCKED" : "COMPLETE"
  const result = assembleResult(manifest, levelResults, status, globalJudgeResult)

  // ── Step 6: Write run artifacts to local workspace ──────────────────────
  writeRunArtifacts(result, levelResults, ctx.worktree)

  return result
}

/**
 * Assemble the final EngineResult with HITL payload.
 */
function assembleResult(
  manifest: Manifest,
  levelResults: LevelResult[],
  status: EngineResult["status"],
  globalJudgeResult?: GlobalJudgeResult,
): EngineResult {
  const proposedChanges = levelResults
    .flatMap((lr) => lr.node_results)
    .filter((nr) => nr.status === "APPROVED")
    .map((nr) => ({
      node_id: nr.node_id,
      files: nr.final_diffs.map((d) => d.file),
      description: manifest.nodes.find((n) => n.id === nr.node_id)?.mutation || "",
    }))

  const blockingIssues: string[] = []
  for (const lr of levelResults) {
    for (const nr of lr.node_results) {
      if (nr.status === "UNRESOLVABLE_ANOMALY") {
        blockingIssues.push(`Node ${nr.node_id}: UNRESOLVABLE_ANOMALY after ${nr.respins_used} re-spins — ${nr.fault_vector?.description || "unknown fault"}`)
      }
      if (nr.status === "REJECTED") {
        blockingIssues.push(`Node ${nr.node_id}: REJECTED by edge-judge — ${nr.fault_vector?.description || "unknown"}`)
      }
    }
    if (lr.ast_aggregator_result?.merge_status === "PARTIAL_CONFLICT") {
      blockingIssues.push(`Level ${lr.level_index}: AST Aggregator PARTIAL_CONFLICT — isolated lanes: ${JSON.stringify(lr.ast_aggregator_result.isolated_lanes)}`)
    }
  }
  if (globalJudgeResult?.missing) {
    blockingIssues.push(`Global Judge: ${globalJudgeResult.coverage.missing} requirements not covered — ${JSON.stringify(globalJudgeResult.coverage.missing_detail)}`)
  }
  if (globalJudgeResult && globalJudgeResult.regression_vectors.length > 0) {
    blockingIssues.push(`Global Judge: ${globalJudgeResult.regression_vectors.length} regression vectors detected`)
  }

  const hitlStatus: HITLPayload["status"] =
    status === "ESCALATED" ? "ESCALATED" :
    status === "BLOCKED" ? "BLOCKED" :
    manifest.hitl.required ? "AWAITING_CONFIRMATION" : "AWAITING_CONFIRMATION"

  const hitlPayload: HITLPayload = {
    workflow_id: manifest.workflow_id,
    summary: `Workflow ${manifest.workflow_id}: ${manifest.nodes.length} nodes across ${manifest.levels.length} levels — ${levelResults.flatMap((lr) => lr.node_results).filter((nr) => nr.status === "APPROVED").length} approved, ${blockingIssues.length} blocking issues`,
    proposed_changes: proposedChanges,
    integrity_score: globalJudgeResult?.integrity_score ?? 0,
    global_judge_verdict: globalJudgeResult?.verdict ?? "NOT_RUN",
    blocking_issues: blockingIssues,
    status: hitlStatus,
  }

  return {
    workflow_id: manifest.workflow_id,
    routing_decision: manifest.routing_decision,
    levels: levelResults,
    global_judge_result: globalJudgeResult,
    hitl_payload: hitlPayload,
    status,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8: PLUGIN EXPORT
// Exposes the `run_manifest` tool that the Tier-0 mode calls.
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG_DIR = dirname(fileURLToPath(import.meta.url))
const SKILLS_DIR = resolve(CONFIG_DIR, "..", "skills")

export const MasEngine: Plugin = async (input: PluginInput) => {
  return {
    tool: {
      /**
       * run_manifest — Execute a MAS spawn manifest deterministically.
       *
       * Accepts the path to a spawn_manifest.json file, validates it against
       * the schema and 8 cross-document constraints, then mechanically
       * dispatches all nodes through their declared phase_chains with
       * Promise.all() parallelism per topological level.
       *
       * Returns a structured EngineResult with HITL payload.
       */
      run_manifest: tool({
        description:
          "Execute a MAS spawn manifest. Validates the manifest, dispatches generic LLM agents in parallel per DAG level, runs mechanical gates (edge-judge, ast-aggregator, global-judge), and returns a HITL payload. Accepts the file path to a spawn_manifest.json.",
        args: {
          manifest_path: tool.schema.string().describe("Path to the spawn_manifest.json file (relative to project root or absolute)"),
          parent_session_id: tool.schema.string().optional().describe("Parent session ID for spawned child sessions (defaults to current session)"),
        },
        async execute(args, context) {
          const manifestPath = resolve(context.worktree, args.manifest_path)
          const parentSessionId = args.parent_session_id || context.sessionID

          context.metadata({
            title: `MAS Engine: ${manifestPath}`,
            metadata: { manifest_path: manifestPath, parent_session: parentSessionId },
          })

          const ctx: SpawnBridgeContext = {
            client: input.client,
            worktree: context.worktree,
            directory: context.directory,
            skillsDir: SKILLS_DIR,
            parentSessionId,
          }

          try {
            const result = await runManifest(manifestPath, ctx)
            return {
              output: JSON.stringify(result, null, 2),
              metadata: {
                workflow_id: result.workflow_id,
                status: result.status,
                integrity_score: result.global_judge_result?.integrity_score,
                levels_completed: result.levels.length,
                blocking_issues: result.hitl_payload.blocking_issues.length,
              },
            }
          } catch (e: unknown) {
            const errorMsg = e instanceof Error ? e.message : String(e)
            return {
              output: JSON.stringify({
                status: "ERROR",
                error: errorMsg,
                manifest_path: manifestPath,
              }, null, 2),
              metadata: { error: errorMsg },
            }
          }
        },
      }),
    },
  }
}
