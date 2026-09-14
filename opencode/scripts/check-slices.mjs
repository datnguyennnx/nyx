#!/usr/bin/env node
// MAS slice-graph checker: flat JSON array of lanes {id, level, targets}.
// Same-level lanes must not share a target; reuse at a later level is a legal
// serialised dependency. Usage: check-slices.mjs '<json>' | @<path> | --help.
// Zero dependencies, ESM, node: builtins only.

import fs from "node:fs";
const USAGE =
  "usage: check-slices.mjs <lanes-json | @<path>> | check-slices.mjs -h\n" +
  "  <lanes-json>  JSON array of {id, level, targets}\n" +
  "  @<path>       read the JSON array from a file";
const isStr = (v) => typeof v === "string" && v.length > 0;
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isAbs = (p) => p.startsWith("/") || /^[A-Za-z]:[\\/]/.test(p);
const findings = [];
const serialised = [];
function check(lanes) {
  const ids = new Set();
  const byLevel = new Map();
  const byTarget = new Map();
  lanes.forEach((lane, i) => {
    if (!isObj(lane)) return void findings.push(`shape lanes[${i}] must be an object`);
    const id = isStr(lane.id) ? lane.id : null;
    const who = id ? `lane "${id}"` : `lanes[${i}]`;
    if (!id) findings.push(`shape ${who}.id must be a non-empty string`);
    else if (ids.has(id)) findings.push(`shape duplicate lane id "${id}"`);
    else ids.add(id);
    const lvl = Number.isInteger(lane.level) && lane.level >= 0 ? lane.level : null;
    if (lvl === null) findings.push(`shape ${who}.level must be an integer >= 0`);
    if (!Array.isArray(lane.targets) || lane.targets.length === 0)
      return void findings.push(`shape ${who}.targets must be a non-empty array`);
    const own = new Set();
    for (const t of lane.targets) {
      if (!isStr(t)) {
        findings.push(`shape ${who} target must be a non-empty string`);
        continue;
      }
      if (isAbs(t)) findings.push(`shape ${who} target "${t}" must be repo-relative`);
      else if (t.split(/[\\/]/).includes(".."))
        findings.push(`shape ${who} target "${t}" must not contain ".."`);
      if (own.has(t)) findings.push(`shape ${who} duplicate target "${t}"`);
      own.add(t);
      if (lvl === null) continue;
      if (!byLevel.has(lvl)) byLevel.set(lvl, new Map());
      const m = byLevel.get(lvl);
      if (!m.has(t)) m.set(t, []);
      if (id && !m.get(t).includes(id)) m.get(t).push(id);
      if (!byTarget.has(t)) byTarget.set(t, new Set());
      byTarget.get(t).add(lvl);
    }
  });
  for (const m of byLevel.values())
    for (const [t, who] of m)
      if (who.length > 1) findings.push(`slice-overlap ${who.join(" + ")} both target ${t}`);
  for (const [t, ls] of byTarget)
    if (ls.size > 1)
      serialised.push(`serialised: ${t} (levels ${[...ls].sort((a, b) => a - b).join(" -> ")})`);
}
const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  console.log(USAGE);
  process.exit(0);
}
if (argv.length !== 1) {
  console.error(USAGE);
  process.exit(2);
}
let text = argv[0];
if (text.startsWith("@")) {
  const p = text.slice(1);
  try { text = fs.readFileSync(p, "utf8"); } catch {
    console.error(`check-slices: cannot read ${p}`);
    process.exit(2);
  }
}
let lanes;
try { lanes = JSON.parse(text); } catch (e) {
  findings.push(`shape payload is not valid JSON: ${e.message}`);
}
if (lanes !== undefined) {
  if (Array.isArray(lanes)) check(lanes);
  else findings.push("shape payload must be a JSON array of lanes");
}
for (const f of findings) console.log(f);
for (const s of serialised) console.log(s);
console.log(`findings:${findings.length}`);
process.exit(findings.length ? 1 : 0);
