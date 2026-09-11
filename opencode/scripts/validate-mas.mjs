#!/usr/bin/env node
// validate-mas.mjs — S-13 validator for the OpenCode MAS surface.
// Zero dependencies, pure ESM, Node stdlib only.
//
// Checks:
//   1. agents/*.md frontmatter keys, mode, and permissions shape
//   2. skills/*/SKILL.md frontmatter has name + description
//   3. references/... and skills/... links resolve (file dir, then repo root)
//   4. skills/mas/SKILL.md, skills/mas/references/interaction.md, agents/ship-mas.md
//      use Step N/7 and never Loop 0-6 or N/8 | N/9
//   5. permission ordering (LAST-match-wins => deny-first): flag same-action
//      allow shadowed by a later broad "*" deny or identical-pattern deny
//   6. canonical paths in skills/** + agents/**: only absolute
//      `~/.config/opencode/{scripts,skills}/…`; agents must not use
//      `references/`, `./`, `repo opencode/`, or bare `scripts/`|`skills/`
//   7. status vocab outside verification.md: envelope
//      PASS|FAIL|PARTIAL|NO_VERIFICATION|NO_RESULTS only
//   8. legacy V1 action names (`bash`,`task`,`write`,`patch`,`doom_loop`,
//      `lsp`, `gthings_*`) anywhere in a permission entry
//   9. legacy V2-rejected top-level opencode.json keys + legacy `mcp` shape
//  10. `instructions` top-level key as a V2 no-op warning
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

// V1 action names / plugin mis-names that must never appear as `action` values.
const LEGACY_ACTIONS = new Set([
  "bash", "task", "write", "patch", "doom_loop", "lsp",
]);
// Legacy top-level keys rejected by the V2 opencode.json config schema.
const V2_LEGACY_KEYS = [
  "permission", "agent", "mode", "provider", "command", "reference", "plugin",
  "snapshot", "attachment", "autoshare", "small_model", "enabled_providers",
  "disabled_providers", "autoupdate", "tools", "logLevel", "server",
  "subagent_depth",
];
// V2 no-ops: accepted by the parser but not loaded.
const V2_WARN_KEYS = ["instructions"];

const findings = [];

function isLegacyAction(action) {
  const a = String(action || "").toLowerCase();
  return LEGACY_ACTIONS.has(a) || /^gthings_/.test(a);
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
  if (isLegacyAction(fields.action)) {
    report(abs, entry.line, `legacy action "${fields.action}"`, "legacy-action");
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

// --- requirement 4: step/loop phrasing ------------------------------------
const MAS_FILES = [
  path.join(ROOT, "skills", "mas", "SKILL.md"),
  path.join(ROOT, "skills", "mas", "references", "interaction.md"),
  path.join(ROOT, "agents", "ship-mas.md"),
];
function checkStepPhrasing(abs) {
  const text = readText(abs);
  if (text === null) {
    report(abs, 0, "missing file", "io");
    return;
  }
  if (!/\bStep N\/7\b/.test(text)) {
    report(abs, 1, 'missing "Step N/7" phrasing', "step-phrasing");
  }
  text.split(/\r?\n/).forEach((line, i) => {
    const loop = line.match(/\bLoop 0[-\u2013]6\b/);
    if (loop) report(abs, i + 1, `forbidden phrasing "${loop[0]}" (expected Step N/7)`, "step-phrasing");
    const m = line.match(/\bN\/[89]\b/);
    if (m) report(abs, i + 1, `forbidden phrasing "${m[0]}" (expected Step N/7)`, "step-phrasing");
  });
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
    if (isLegacyAction(action)) {
      report(abs, actionLines[k] || 1, `legacy action "${action}"`, "legacy-action");
    }
  });
}

// --- check D: V2 opencode.json keys / mcp shape ------------------------------
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
  for (const k of V2_LEGACY_KEYS) {
    if (Object.prototype.hasOwnProperty.call(data, k)) {
      report(abs, at(k), `legacy config key "${k}"`, "config-key");
    }
  }
  for (const k of V2_WARN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(data, k)) {
      report(abs, at(k), `warning: "${k}" is a V2 no-op (accepted, not loaded)`, "instructions");
    }
  }
  if (data.mcp && typeof data.mcp === "object" && !Array.isArray(data.mcp)) {
    const keys = Object.keys(data.mcp);
    if (keys.length && (!keys.includes("servers") || keys.some((k) => k !== "servers"))) {
      report(abs, at("mcp"), 'legacy "mcp" shape (server entries must be under mcp.servers)', "config-key");
    }
  }
}

// --- check B: canonical paths -----------------------------------------------
function checkCanonPath(abs) {
  const text = readText(abs);
  if (text === null) return;
  const norm = abs.split(path.sep).join("/");
  const isAgent = /\/agents\/[^/]+\.md$/.test(norm);
  const isSkillMd = /\/skills\/.*SKILL\.md$/.test(norm);
  const extended = isAgent || isSkillMd;
  text.split(/\r?\n/).forEach((line, i) => {
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
    if (tok) report(abs, i + 1, `non-canonical path ${tok}`, "canonical-path");
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
for (const f of skillFiles) checkSkill(f);
for (const f of MAS_FILES) checkStepPhrasing(f);
for (const f of [...agentFiles, ...skillFiles, ...masRefFiles]) checkLinks(f);
for (const f of [...agentFiles, ...allSkillsMd]) {
  checkCanonPath(f);
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
