#!/usr/bin/env node
// validate-mas.mjs: S-13 validator for the OpenCode MAS surface.
// Zero dependencies, pure ESM, Node stdlib only.
//
// Checks:
//   1. agents/*.md frontmatter keys, mode, and permissions shape
//   2. skills/*/SKILL.md frontmatter has name + description
//   3. references/... and skills/... links resolve (file dir, then repo root)
//   4. skills/mas/SKILL.md, skills/mas/references/interaction.md, agents/ship-mas.md
//      use the current step phrasing; the retired loop-range and step-count forms are rejected
//   5. permission ordering (LAST-match-wins => deny-first): flag same-action
//      allow shadowed by a later broad "*" deny or identical-pattern deny
//   6. absolute paths in skills/** + agents/**: only absolute
//      `~/.config/opencode/{scripts,skills}/…`; agents must not use
//      `references/`, `./`, `repo opencode/`, or bare `scripts/`|`skills/`
//   7. status vocab outside verification.md: envelope
//      PASS|FAIL|PARTIAL|NO_VERIFICATION|NO_RESULTS only
//   8. actions that must never appear (`bash`,`task`,`write`,`patch`,
//      `doom_loop`, `lsp`) anywhere in a permission entry
//   9. config keys rejected by this schema + rejected `mcp` shape
//  10. `instructions` top-level key (accepted but not loaded)
//  11. permission coverage: `execute` and a `.env` `read` are denied (each
//      with the required resource), and at least 20 deny entries total; the
//      shell invariant lives in check 13.
//  12. exactly one skill owns each `Triggers:` token (a skill without the
//      marker is not an error)
//  13. shell policy: no `shell` entry in opencode.json may have effect
//      `allow` (nothing is pre-approved any more), the broad `shell *` entry
//      must be `ask` so the capability is never silently open, the required
//      destructive/egress/interpreter denies are present, the primary denies
//      `shell`, and no subagent denies it. `node` is deliberately NOT denied,
//      because the project's own validator scripts are `node` invocations and
//      the tester must be able to run them, so a `node` command reaches the
//      operator as a prompt rather than a refusal. `git -C` is deliberately denied:
//      `*` matches spaces, so no `-C` allow pattern can ever be written safely,
//      and an explicit deny is the only correct expression that survives any
//      later widening of what an operator will approve.
//  14. shared-rules mirrors: agents/ship-mas.md and skills/mas/SKILL.md each
//      carry, strictly between their begin/end sentinels, the full text of the
//      canonical skills/mas/references/shared-rules.md; the block is non-empty
//      and the two hosts agree.
//
// Prints one `file:line reason` line per finding, a per-rule count, then a
// final `findings:N` line; exit 1 on any finding, 0 when clean.
// Missing files/dirs are reported, never thrown.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

const AGENT_KEYS = new Set([
  "description", "mode", "model", "system", "permissions", "steps",
  "hidden", "disabled", "request", "color",
]);
const KNOWN_ILLEGAL = new Set([
  "name", "prompt", "permission", "tools", "disable",
  "maxSteps", "max-iterations",
]);
const MODES = new Set(["primary", "subagent", "all"]);
const EFFECTS = new Set(["allow", "deny", "ask"]);
const PERM_KEYS = new Set(["action", "resource", "effect"]);

// Actions that must never appear as `action` values.
const FORBIDDEN_ACTIONS = new Set([
  "bash", "task", "write", "patch", "doom_loop", "lsp",
]);
// Config keys rejected by this opencode.json schema.
const REJECTED_CONFIG_KEYS = [
  "permission", "agent", "mode", "provider", "command", "reference", "plugin",
  "snapshot", "attachment", "autoshare", "small_model", "enabled_providers",
  "disabled_providers", "autoupdate", "tools", "logLevel", "server",
  "subagent_depth",
];
// Keys accepted by the parser but not loaded.
const WARN_CONFIG_KEYS = ["instructions"];

const findings = [];

function isForbiddenAction(action) {
  const a = String(action || "").toLowerCase();
  return FORBIDDEN_ACTIONS.has(a);
}

function rel(abs) {
  const r = path.relative(ROOT, abs);
  return !r || r.startsWith("..") ? abs : r.split(path.sep).join("/");
}
function report(abs, line, reason, rule = "io") {
  findings.push({ file: rel(abs), line, reason, rule });
}
function readText(abs) {
  try {
    return fs.readFileSync(abs, "utf8");
  } catch {
    return null;
  }
}
function listDir(abs) {
  try {
    return fs.readdirSync(abs, { withFileTypes: true });
  } catch {
    report(abs, 0, "missing directory", "io");
    return null;
  }
}
const unquote = (s) =>
  s.replace(/\s+#.*$/, "").trim().replace(/^["']|["']$/g, "");

// --- tiny line-based YAML frontmatter parser ------------------------------
// kind: null => missing file (already reported); ok:false => no frontmatter
function frontmatter(abs) {
  const text = readText(abs);
  if (text === null) {
    report(abs, 0, "missing file", "io");
    return null;
  }
  const lines = text.split(/\r?\n/);
  const start = 2;
  if ((lines[0] || "").trim() !== "---") {
    return { ok: false, text, lines, content: [], start };
  }
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) return { ok: false, text, lines, content: lines.slice(1), start };
  return { ok: true, text, lines, content: lines.slice(1, end), start };
}

function topKeys(fm) {
  const out = [];
  fm.content.forEach((line, i) => {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m) out.push({ key: m[1], value: m[2].trim(), line: fm.start + i });
  });
  return out;
}

// permissions: block -> list entries, each split into joined key/value text
function permEntries(fm) {
  const idx = fm.content.findIndex((l) => /^permissions:\s*$/.test(l));
  if (idx === -1) return null;
  const entries = [];
  let cur = null;
  for (let i = idx + 1; i < fm.content.length; i++) {
    const line = fm.content[i];
    if (/^[A-Za-z0-9_-]+:/.test(line)) break; // next top-level key
    const m = line.match(/^\s*-\s*(.*)$/);
    if (m) {
      cur = { line: fm.start + i, parts: [m[1]] };
      entries.push(cur);
    } else if (cur && line.trim()) {
      cur.parts.push(line.trim());
    }
  }
  return entries;
}

function validatePerm(abs, entry) {
  const blob = entry.parts.join(" ");
  const fields = {};
  const re = /(action|resource|effect):\s*("[^"]*"|'[^']*'|\S+)/g;
  let m;
  while ((m = re.exec(blob))) fields[m[1]] = m[2].replace(/^["']|["']$/g, "");
  const keyRe = /(?:^|\s)([A-Za-z][A-Za-z0-9_-]*):/g;
  const seen = new Set();
  while ((m = keyRe.exec(blob))) {
    if (PERM_KEYS.has(m[1])) {
      seen.add(m[1]);
    } else {
      report(abs, entry.line, `unexpected permissions key "${m[1]}"`, "permissions");
    }
  }
  for (const k of ["action", "resource", "effect"]) {
    if (!seen.has(k)) report(abs, entry.line, `permissions entry missing "${k}"`, "permissions");
  }
  if (isForbiddenAction(fields.action)) {
    report(abs, entry.line, `forbidden action "${fields.action}"`, "forbidden-action");
  }
  if (fields.effect !== undefined && !EFFECTS.has(fields.effect)) {
    report(abs, entry.line, `invalid permissions effect "${fields.effect}"`, "permissions");
  }
}

function checkAgent(abs) {
  const fm = frontmatter(abs);
  if (!fm) return;
  if (!fm.ok) {
    report(abs, 1, "missing YAML frontmatter", "agent-frontmatter");
    return;
  }
  const byKey = new Map();
  for (const k of topKeys(fm)) {
    byKey.set(k.key, k);
    if (KNOWN_ILLEGAL.has(k.key)) {
      report(abs, k.line, `illegal frontmatter key "${k.key}"`, "agent-frontmatter");
    } else if (!AGENT_KEYS.has(k.key)) {
      report(abs, k.line, `unknown frontmatter key "${k.key}"`, "agent-frontmatter");
    }
  }
  const mode = byKey.get("mode");
  if (mode && !MODES.has(unquote(mode.value))) {
    report(abs, mode.line, `invalid mode "${unquote(mode.value)}" (expected primary|subagent|all)`, "agent-frontmatter");
  }
  const entries = permEntries(fm);
  if (entries !== null) {
    for (const e of entries) validatePerm(abs, e);
    checkPermOrder(abs, entries.map((e) => ({ ...permFields(e.parts.join(" ")), line: e.line })));
  } else if (byKey.has("permissions")) {
    report(abs, byKey.get("permissions").line, "permissions is not a list of {action,resource,effect}", "agent-frontmatter");
  }
}

function checkSkill(abs) {
  const fm = frontmatter(abs);
  if (!fm) return;
  if (!fm.ok) {
    report(abs, 1, "missing YAML frontmatter", "skill-frontmatter");
    return;
  }
  const keys = new Set(topKeys(fm).map((k) => k.key));
  if (!keys.has("name")) report(abs, fm.start, 'missing frontmatter key "name"', "skill-frontmatter");
  if (!keys.has("description")) report(abs, fm.start, 'missing frontmatter key "description"', "skill-frontmatter");
}

// --- skill frontmatter keys (permissive: allows "." and "/") ---------------
// The strict topKeys() regex cannot see dotted/slashed keys such as
// `metadata.opencode/autoinvoke`, so they would otherwise be invisible.
const SKILL_KEYS = new Set([
  "name", "description", "metadata", "metadata.opencode/autoinvoke",
]);
function checkSkillKeys(abs) {
  const fm = frontmatter(abs);
  if (!fm || !fm.ok) return;
  fm.content.forEach((line, i) => {
    const m = line.match(/^([A-Za-z0-9_.\/-]+):/);
    if (!m) return;
    if (!SKILL_KEYS.has(m[1])) {
      report(abs, fm.start + i, `unknown skill key "${m[1]}"`, "skill-key");
    }
  });
}

// --- one owner per skill trigger token ------------------------------------
// A trigger surface is the comma-separated token list that follows the
// literal marker below inside a skill's frontmatter `description:`. Exactly
// one skill may claim a token; later claimers are reported against the first.
const TRIGGER_MARKER = "Triggers:";
const MIN_TRIGGER_LEN = 3;

// The description value plus its indented continuation lines, with the line
// of the `description:` key itself. null when there is no description key.
function descriptionBlock(fm) {
  const idx = fm.content.findIndex((l) => /^description:\s*(.*)$/.test(l));
  if (idx === -1) return null;
  const m = fm.content[idx].match(/^description:\s*(.*)$/);
  const parts = [m[1]];
  for (let i = idx + 1; i < fm.content.length; i++) {
    const line = fm.content[i];
    if (/^[A-Za-z0-9_.\/-]+:/.test(line)) break; // next top-level key
    if (line.trim()) parts.push(line.trim());
  }
  return { text: parts.join(" "), line: fm.start + idx };
}

// Tokens after the marker, or null when the marker is absent. Surrounding
// quote marks and trailing sentence punctuation belong to the frontmatter
// syntax, not to the token, so they are stripped like the link check does.
function triggerTokens(desc) {
  const at = desc.indexOf(TRIGGER_MARKER);
  if (at === -1) return null;
  return desc
    .slice(at + TRIGGER_MARKER.length)
    .split(",")
    .map((t) =>
      t
        .trim()
        .replace(/^["']|["']$/g, "")
        .replace(/[.,;:]+$/, "")
        .toLowerCase(),
    );
}

function checkSkillTriggerOwnership(files) {
  const owners = new Map();
  for (const abs of files) {
    const fm = frontmatter(abs);
    if (!fm || !fm.ok) continue;
    const desc = descriptionBlock(fm);
    if (!desc) continue;
    const tokens = triggerTokens(desc.text);
    if (tokens === null) continue; // no marker is not a finding
    const seen = new Set();
    for (const raw of tokens) {
      const token = raw.trim();
      if (token.length < MIN_TRIGGER_LEN || seen.has(token)) continue;
      seen.add(token);
      const first = owners.get(token);
      if (!first) {
        owners.set(token, { file: abs, line: desc.line });
        continue;
      }
      report(
        abs,
        desc.line,
        `trigger token '${token}' also claimed by ${rel(first.file)}`,
        "skill-trigger-ownership",
      );
    }
  }
}

// --- shared-rules canonical mirrors ----------------------------------------
// The canonical contract is the full content of
// skills/mas/references/shared-rules.md (no markers). Every host surface
// mirrors that text verbatim between the sentinels:
//   <!-- shared-rules:begin -->
//   ...exactly the canonical text...
//   <!-- shared-rules:end -->
// Each host block must be non-empty and equal the canonical text, comparing
// while ignoring only a single trailing newline. Missing markers, an empty
// block, or any other difference is a finding, and the hosts must also agree
// with each other.
const SHARED_RULES_CANONICAL = path.join(
  ROOT,
  "skills",
  "mas",
  "references",
  "shared-rules.md",
);
const SHARED_RULES_HOSTS = [
  path.join(ROOT, "agents", "ship-mas.md"),
  path.join(ROOT, "skills", "mas", "SKILL.md"),
];
const SHARED_BEGIN = "<!-- shared-rules:begin -->";
const SHARED_END = "<!-- shared-rules:end -->";

// Drop exactly one trailing newline (LF or CRLF); this is the only
// normalisation the mirror comparison allows.
function stripOneTrailingNewline(text) {
  if (text.endsWith("\r\n")) return text.slice(0, -2);
  if (text.endsWith("\n")) return text.slice(0, -1);
  return text;
}

// The block strictly between the sentinels. Returns null (missing file) or
// { ok:true, text, line } | { ok:false, line, reason }.
function sharedBlock(abs) {
  const text = readText(abs);
  if (text === null) return null;
  const lines = text.split(/\r?\n/);
  const begin = lines.findIndex((l) => l.trim() === SHARED_BEGIN);
  if (begin === -1) {
    return { ok: false, line: 1, reason: "missing shared-rules:begin marker" };
  }
  let end = -1;
  for (let i = begin + 1; i < lines.length; i++) {
    if (lines[i].trim() === SHARED_END) {
      end = i;
      break;
    }
  }
  if (end === -1) {
    return { ok: false, line: begin + 1, reason: "missing shared-rules:end marker" };
  }
  return { ok: true, text: lines.slice(begin + 1, end).join("\n"), line: end + 1 };
}

// 1-based line numbers spanning the block, markers included; empty when the
// file carries no begin marker. The canonical contract names paths in prose
// (the gate line names skills/mas/, agents/, and scripts/), so its mirrored
// region is exempt from the path scans; the canonical file is exempt whole.
function sharedBlockLines(abs) {
  const exempt = new Set();
  const text = readText(abs);
  if (text === null) return exempt;
  const lines = text.split(/\r?\n/);
  const begin = lines.findIndex((l) => l.trim() === SHARED_BEGIN);
  if (begin === -1) return exempt;
  exempt.add(begin + 1);
  for (let i = begin + 1; i < lines.length; i++) {
    exempt.add(i + 1);
    if (lines[i].trim() === SHARED_END) break;
  }
  return exempt;
}

function isSharedRulesCanonical(abs) {
  return path.resolve(abs) === path.resolve(SHARED_RULES_CANONICAL);
}

function checkSharedRules() {
  const canonicalRaw = readText(SHARED_RULES_CANONICAL);
  if (canonicalRaw === null) {
    report(SHARED_RULES_CANONICAL, 0, "missing canonical shared-rules file", "shared-rules-mirror");
    return;
  }
  const canonical = stripOneTrailingNewline(canonicalRaw);
  const blocks = [];
  for (const abs of SHARED_RULES_HOSTS) {
    const block = sharedBlock(abs);
    if (block === null) {
      report(abs, 0, "missing file", "shared-rules-mirror");
      continue;
    }
    if (!block.ok) {
      report(abs, block.line, block.reason, "shared-rules-mirror");
      continue;
    }
    const body = stripOneTrailingNewline(block.text);
    if (body.trim().length === 0) {
      report(abs, block.line, "empty shared-rules block", "shared-rules-mirror");
      continue;
    }
    if (body !== canonical) {
      report(
        abs,
        block.line,
        `shared-rules block differs from canonical ${rel(SHARED_RULES_CANONICAL)}`,
        "shared-rules-mirror",
      );
    }
    blocks.push({ abs, line: block.line, body });
  }
  if (blocks.length !== SHARED_RULES_HOSTS.length) return;
  const first = blocks[0];
  for (const b of blocks.slice(1)) {
    if (b.body === first.body) continue;
    report(b.abs, b.line, `shared-rules block differs from ${rel(first.abs)}`, "shared-rules-mirror");
  }
}

// --- requirement 4: step/loop phrasing ------------------------------------
const MAS_FILES = [
  path.join(ROOT, "skills", "mas", "SKILL.md"),
  path.join(ROOT, "skills", "mas", "references", "interaction.md"),
  path.join(ROOT, "agents", "ship-mas.md"),
];
// Narrow, negative-only scan: forbidden denominators and legacy loop phrasing.
// Safe for every agent file because it never demands a `Step N/7` literal.
function checkStepPhrasingNegative(abs) {
  const text = readText(abs);
  if (text === null) return;
  text.split(/\r?\n/).forEach((line, i) => {
    const loop = line.match(/\bLoop 0[-\u2013]6\b/);
    if (loop) report(abs, i + 1, `forbidden phrasing "${loop[0]}" (expected Step N/7)`, "step-phrasing");
    const m = line.match(/\bN\/[89]\b/);
    if (m) report(abs, i + 1, `forbidden phrasing "${m[0]}" (expected Step N/7)`, "step-phrasing");
  });
}
function checkStepPhrasing(abs) {
  const text = readText(abs);
  if (text === null) {
    report(abs, 0, "missing file", "io");
    return;
  }
  if (!/\bStep N\/7\b/.test(text)) {
    report(abs, 1, 'missing "Step N/7" phrasing', "step-phrasing");
  }
  checkStepPhrasingNegative(abs);
}

// --- requirement 3: resolve references/... and skills/... links -----------
// bases: the file's own directory, the enclosing skill dir (nearest ancestor
// holding SKILL.md), then repo root. `references/...` is skill-root relative,
// while `skills/...` is repo-root relative.
function linkBases(abs) {
  const bases = [path.dirname(abs)];
  let dir = path.dirname(abs);
  while (dir.startsWith(ROOT)) {
    if (fs.existsSync(path.join(dir, "SKILL.md"))) bases.push(dir);
    if (dir === ROOT) break;
    dir = path.dirname(dir);
  }
  bases.push(ROOT);
  return bases;
}

function checkLinks(abs) {
  const text = readText(abs);
  if (text === null) return;
  const bases = linkBases(abs);
  text.split(/\r?\n/).forEach((line, i) => {
    const re = /(?:\.{0,2}\/)?((?:references|skills)\/[\w./*-]+)/g;
    let m;
    while ((m = re.exec(line))) {
      const p = m[1].replace(/[.,;:]+$/, "");
      if (!p || p.includes("*")) continue;
      if (!bases.some((b) => fs.existsSync(path.resolve(b, p)))) {
        report(abs, i + 1, `unresolved reference "${p}"`, "links");
      }
    }
  });
}

// --- check A: permission ordering (LAST-match-wins => deny-first) -----------
function permFields(blob) {
  const fields = {};
  const re = /(action|resource|effect):\s*("[^"]*"|'[^']*'|\S+)/g;
  let m;
  while ((m = re.exec(blob))) fields[m[1]] = m[2].replace(/^["']|["']$/g, "");
  return fields;
}
// True when a later `ask` resource re-matches (a subset of) an earlier `deny`
// resource, so last-match-wins lets the ask shadow the deny. Mirrors the
// equality/`*` rule of the allow check and extends it with a glob-prefix test
// (a general `curl *` deny is shadowed by a narrower `curl *127.0.0.1...*` ask).
function resourceShadows(denyRes, askRes) {
  const d = String(denyRes || "");
  const a = String(askRes || "");
  if (!d || !a) return false;
  if (d === "*" || a === "*") return true;
  if (d === a) return true;
  const prefix = d.replace(/\*+$/, "");
  return prefix.length > 0 && a.startsWith(prefix);
}
function checkPermOrder(abs, list) {
  for (let j = 0; j < list.length; j++) {
    const d = list[j];
    if (d.effect !== "deny" || !d.action) continue;
    for (let i = 0; i < j; i++) {
      const a = list[i];
      if (a.effect !== "allow" || a.action !== d.action) continue;
      if (d.resource === "*" || (a.resource && d.resource === a.resource)) {
        const pat = d.resource === "*" ? "* deny" : `${d.resource} deny`;
        report(abs, a.line, `shadowing: ${a.action} allow before ${pat}`, "perm-order");
        break;
      }
    }
  }
  // LAST-match-wins also means an `ask` placed AFTER a `deny` for the same
  // action re-opens what the deny closed; report the shadow so the deny-first
  // ordering invariant holds for every effect, not just `allow`.
  for (let j = 0; j < list.length; j++) {
    const a = list[j];
    if (a.effect !== "ask" || !a.action) continue;
    for (let i = 0; i < j; i++) {
      const d = list[i];
      if (d.effect !== "deny" || d.action !== a.action) continue;
      if (resourceShadows(d.resource, a.resource)) {
        const pat = d.resource === "*" ? "* deny" : `${d.resource} deny`;
        report(abs, a.line, `shadowing: ${a.action} ask after ${pat}`, "perm-order");
        break;
      }
    }
  }
}
function checkJsonPerms(abs) {
  const text = readText(abs);
  if (text === null) return;
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return;
  }
  const arr = data && data.permissions;
  if (!Array.isArray(arr)) return;
  const lines = text.split(/\r?\n/);
  const actionLines = [];
  lines.forEach((ln, i) => {
    if (/"action"\s*:/.test(ln)) actionLines.push(i + 1);
  });
  checkPermOrder(
    abs,
    arr.map((e, k) => ({
      action: String((e && e.action) || ""),
      resource: String((e && e.resource) || ""),
      effect: String((e && e.effect) || ""),
      line: actionLines[k] || 1,
    })),
  );
  arr.forEach((e, k) => {
    const action = String((e && e.action) || "");
    if (isForbiddenAction(action)) {
      report(abs, actionLines[k] || 1, `forbidden action "${action}"`, "forbidden-action");
    }
  });
}

// --- check D: rejected opencode.json keys / mcp shape ------------------------
// Returns a Map of top-level key -> line by scanning the raw JSON text.
function topLevelKeyLines(text) {
  const map = new Map();
  let depth = 0;
  let inStr = false;
  let esc = false;
  let line = 1;
  let strStart = 0;
  let strLine = 1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "\n") line++;
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') {
        inStr = false;
        if (depth === 1) {
          let j = i + 1;
          while (j < text.length && /\s/.test(text[j])) j++;
          if (text[j] === ":") map.set(text.slice(strStart, i), strLine);
        }
      }
      continue;
    }
    if (c === '"') {
      inStr = true;
      esc = false;
      strStart = i + 1;
      strLine = line;
    } else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") depth--;
  }
  return map;
}

function checkConfigKeys(abs) {
  const text = readText(abs);
  if (text === null) {
    report(abs, 0, "missing file", "io");
    return;
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return;
  const keyLines = topLevelKeyLines(text);
  const at = (k) => keyLines.get(k) || 1;
  for (const k of REJECTED_CONFIG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(data, k)) {
      report(abs, at(k), `rejected config key "${k}"`, "config-key");
    }
  }
  for (const k of WARN_CONFIG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(data, k)) {
      report(abs, at(k), `warning: "${k}" is accepted but not loaded`, "instructions");
    }
  }
  if (data.mcp && typeof data.mcp === "object" && !Array.isArray(data.mcp)) {
    const keys = Object.keys(data.mcp);
    if (keys.length && (!keys.includes("servers") || keys.some((k) => k !== "servers"))) {
      report(abs, at("mcp"), 'rejected "mcp" shape (server entries must be under mcp.servers)', "config-key");
    }
  }
}

// --- check E: permission coverage -------------------------------------------
// A config that denies nothing must not pass. `execute` must be denied with
// resource "*", `read` must deny `.env`, and the deny list must stay
// substantial. The shell invariant (no allow, broad `ask`) is owned by
// checkShellPolicy (check H).
const REQUIRED_DENIES = [
  { action: "execute", reason: "missing deny execute *", match: (r) => r === "*" },
  { action: "read", reason: "missing deny read **/*.env*", match: (r) => r.includes(".env") },
];
const MIN_DENIES = 20;

function checkPermissionCoverage(abs) {
  const text = readText(abs);
  if (text === null) return;
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return;
  }
  const arr = data && data.permissions;
  if (!Array.isArray(arr)) return;
  const at = topLevelKeyLines(text).get("permissions") || 1;
  const denies = arr.filter((e) => e && e.effect === "deny");
  for (const req of REQUIRED_DENIES) {
    const ok = denies.some(
      (e) =>
        String((e && e.action) || "") === req.action &&
        req.match(String((e && e.resource) || "")),
    );
    if (!ok) report(abs, at, req.reason, "perm-coverage");
  }
  if (denies.length < MIN_DENIES) {
    report(abs, at, `deny list < ${MIN_DENIES}: secrets unprotected`, "perm-coverage");
  }
}

// --- check G: orchestrator-only capabilities ---------------------------------
// `skill` and `subagent` are globally allowed and held by the primary
// orchestrator alone; every subagent file must deny both. Reuses the shared
// frontmatter helpers (frontmatter/permEntries/permFields) and the trailing-
// comma normalisation, because the inline entry form otherwise yields
// `action === "skill,"` and a false negative.
function checkOrchestratorOnly(abs) {
  const fm = frontmatter(abs);
  if (!fm || !fm.ok) return;
  const modeKey = topKeys(fm).find((k) => k.key === "mode");
  if (!modeKey) return;
  const mode = unquote(modeKey.value);
  if (mode !== "subagent" && mode !== "primary") return;
  const entries = permEntries(fm);
  const norm = (v) => (typeof v === "string" ? v.trim().replace(/,$/, "") : v);
  const perms = (entries || []).map((e) => {
    const p = permFields(e.parts.join(" "));
    return { action: norm(p.action), effect: norm(p.effect), line: e.line };
  });
  const keyLine = topKeys(fm).find((k) => k.key === "permissions");
  const at = (keyLine && keyLine.line) || 1;
  for (const action of ["skill", "subagent"]) {
    const denied = perms.find((p) => p.action === action && p.effect === "deny");
    if (mode === "subagent") {
      if (!denied) report(abs, at, `subagent must deny ${action}`, "orchestrator-only");
    } else if (denied) {
      report(abs, denied.line, `primary must hold ${action}`, "orchestrator-only");
    }
  }
}

// --- check H: shell policy ---------------------------------------------------
// Nothing is pre-approved: no `shell` entry in opencode.json may have effect
// `allow`, and the broad `shell *` entry must be `ask` so the capability is
// never silently open. Permission matching is LAST-match-wins, so a later
// `shell *` allow would win over everything; this check fails on any shell
// allow at all. It also requires a `shell` deny for every destructive,
// egress or interpreter resource, keeps the primary orchestrator denying
// shell, and keeps subagents from denying it. Reuses the shared frontmatter
// helpers (frontmatter/permEntries/permFields) and the trailing-comma
// normalisation below, because the inline entry form otherwise yields
// `action === "shell,"` and a false negative. `git -C` stays explicitly
// denied: `*` matches spaces, so no `-C` pattern can ever be written safely.

// Destructive/egress/interpreter shell resources that must each carry an
// explicit deny. Permissions are matched LAST-match-wins; a backstop that
// silently disappears is worse than none.
const SHELL_REQUIRED_DENIES = new Set([
  "rm *", "rmdir *", "mv *", "dd *", "truncate *", "shred *",
  "chmod *", "chown *", "curl *", "wget *", "nc *", "ssh *", "scp *",
  "git clean *", "git reset *", "git checkout *", "git restore *",
  "git -C *",
  "python *", "python3 *", "sh -c *", "bash -c *",
]);

function checkShellPolicy(abs) {
  const text = readText(abs);
  if (text === null) return;
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return;
  }
  const arr = data && data.permissions;
  const at = topLevelKeyLines(text).get("permissions") || 1;
  const list = Array.isArray(arr) ? arr : [];
  for (const e of list) {
    if (!e || e.action !== "shell" || e.effect !== "allow") continue;
    const resource = String((e && e.resource) || "");
    report(abs, at, `shell allow must not exist: ${resource}`, "shell-policy");
  }

  const askDefault = list.some(
    (e) =>
      e && e.action === "shell" && e.effect === "ask" &&
      String((e && e.resource) || "") === "*",
  );
  if (!askDefault) {
    report(abs, at, "shell default must be ask", "shell-policy");
  }

  for (const resource of SHELL_REQUIRED_DENIES) {
    const ok = list.some(
      (e) =>
        e && e.action === "shell" && e.effect === "deny" &&
        String((e && e.resource) || "") === resource,
    );
    if (!ok) report(abs, at, `missing destructive deny: ${resource}`, "shell-policy");
  }

  for (const f of agentFiles) {
    const fm = frontmatter(f);
    if (!fm || !fm.ok) continue;
    const modeKey = topKeys(fm).find((k) => k.key === "mode");
    if (!modeKey) continue;
    const mode = unquote(modeKey.value);
    const entries = permEntries(fm);
    const norm = (v) => (typeof v === "string" ? v.trim().replace(/,$/, "") : v);
    const perms = (entries || []).map((e) => {
      const p = permFields(e.parts.join(" "));
      return { action: norm(p.action), effect: norm(p.effect), line: e.line };
    });
    const keyLine = topKeys(fm).find((k) => k.key === "permissions");
    const pat = (keyLine && keyLine.line) || 1;
    const denied = perms.find((p) => p.action === "shell" && p.effect === "deny");
    if (mode === "primary") {
      if (!denied) report(f, pat, "primary must deny shell", "shell-policy");
    } else if (mode === "subagent" && denied) {
      report(f, denied.line, "subagent must not deny shell", "shell-policy");
    }
  }
}

// --- check B: absolute paths ------------------------------------------------
function checkAbsPath(abs) {
  const text = readText(abs);
  if (text === null) return;
  const norm = abs.split(path.sep).join("/");
  // The canonical shared-rules file is exempt in full, and each host's
  // mirrored block is exempt across its own span, because the canonical
  // contract names paths in prose (the gate line names skills/mas/, agents/,
  // and scripts/). Every other file and block-external line is still scanned.
  if (isSharedRulesCanonical(abs)) return;
  const exemptLines = sharedBlockLines(abs);
  const isAgent = /\/agents\/[^/]+\.md$/.test(norm);
  const isSkillMd = /\/skills\/.*SKILL\.md$/.test(norm);
  const extended = isAgent || isSkillMd;
  text.split(/\r?\n/).forEach((line, i) => {
    if (exemptLines.has(i + 1)) return;
    const t = line
      .split("~/.config/opencode/scripts/").join("<ABS>/")
      .split("~/.config/opencode/skills/").join("<ABS>/");
    let tok = null;
    if (/opencode\/scripts\//.test(t)) tok = "opencode/scripts/";
    else if (/(^|[\s"'`(\[])scripts\//.test(t)) tok = "scripts/";
    else if (/skills\/mas\//.test(t)) tok = "skills/mas/";
    else if (extended) {
      if (/(^|[\s"'`(\[])\.\//.test(t)) tok = "./";
      else if (/repo opencode\//.test(t)) tok = "repo opencode/";
      else if (/(^|[\s"'`(\[])skills\//.test(t)) tok = "skills/";
      else if (isAgent && /(^|[\s"'`(\[])references\//.test(t)) tok = "references/";
    }
    if (tok) report(abs, i + 1, `non-absolute path ${tok}`, "absolute-path");
  });
}

// --- check C: status vocab ----------------------------------------------------
const ENVELOPE_OK = new Set(["PASS", "FAIL", "PARTIAL", "NO_VERIFICATION", "NO_RESULTS"]);
function checkStatusVocab(abs) {
  if (/verification\.md$/.test(abs)) return;
  const text = readText(abs);
  if (text === null) return;
  text.split(/\r?\n/).forEach((line, i) => {
    const m = line.match(/\bstatus\s*[:=]\s*`?([A-Za-z][\w-]*)/i);
    if (m && !ENVELOPE_OK.has(m[1].toUpperCase())) {
      report(abs, i + 1, `invalid status "${m[1]}" (expected PASS|FAIL|PARTIAL|NO_VERIFICATION|NO_RESULTS)`, "status-vocab");
    }
  });
}

// --- walk -----------------------------------------------------------------
const agentsDir = path.join(ROOT, "agents");
const agentFiles = (listDir(agentsDir) || [])
  .filter((e) => e.isFile() && e.name.endsWith(".md"))
  .map((e) => path.join(agentsDir, e.name));

const skillsDir = path.join(ROOT, "skills");
const skillFiles = [];
for (const e of listDir(skillsDir) || []) {
  if (!e.isDirectory()) continue;
  const f = path.join(skillsDir, e.name, "SKILL.md");
  if (fs.existsSync(f)) skillFiles.push(f);
}

const masRefDir = path.join(ROOT, "skills", "mas", "references");
const masRefFiles = (listDir(masRefDir) || [])
  .filter((e) => e.isFile() && e.name.endsWith(".md"))
  .map((e) => path.join(masRefDir, e.name));

// all markdown under skills/** (recursive) for checks B + C
const allSkillsMd = [];
(function walkSkills(dir) {
  for (const e of listDir(dir) || []) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkSkills(p);
    else if (e.isFile() && e.name.endsWith(".md")) allSkillsMd.push(p);
  }
})(skillsDir);

const jsonFile = path.join(ROOT, "opencode.json");

for (const f of agentFiles) checkAgent(f);
checkJsonPerms(jsonFile);
checkConfigKeys(jsonFile);
checkPermissionCoverage(jsonFile);
for (const f of agentFiles) checkOrchestratorOnly(f);
checkShellPolicy(jsonFile);
for (const f of skillFiles) {
  checkSkill(f);
  checkSkillKeys(f);
}
checkSkillTriggerOwnership(skillFiles);
for (const f of MAS_FILES) checkStepPhrasing(f);
for (const f of agentFiles) {
  if (MAS_FILES.includes(f)) continue;
  checkStepPhrasingNegative(f);
}
checkSharedRules();
for (const f of [...agentFiles, ...skillFiles, ...masRefFiles]) checkLinks(f);
for (const f of [...agentFiles, ...allSkillsMd]) {
  checkAbsPath(f);
  checkStatusVocab(f);
}

findings.sort((a, b) =>
  a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1,
);
for (const f of findings) console.log(`${f.file}:${f.line} ${f.reason}`);
const counts = new Map();
for (const f of findings) counts.set(f.rule, (counts.get(f.rule) || 0) + 1);
const byRule = [...counts.entries()]
  .sort((a, b) => (a[0] < b[0] ? -1 : 1))
  .map(([r, c]) => `${r}=${c}`)
  .join(" ");
console.log(`by-rule:${byRule ? " " + byRule : " none"}`);
console.log(`findings:${findings.length}`);
process.exit(findings.length ? 1 : 0);
