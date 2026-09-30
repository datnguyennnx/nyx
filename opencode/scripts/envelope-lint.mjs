#!/usr/bin/env node
// envelope-lint.mjs: deterministic envelope validator, no deps, pure ESM.
import fs from "node:fs";
const tok = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const has = (t, re) => re.test(t);
const FILELINE = /[\w./-]+\.[A-Za-z]+:\d+/;
const REQREF = /[SR]-\d+\s*(→|->)/;
const CANON_STATUS = new Set(["PASS", "FAIL", "PARTIAL", "NO_VERIFICATION", "NO_RESULTS"]);
function lint(t) {
  if (!t.trim()) return { ok: false, reason: "FAIL empty input" };
  const n = tok(t), ls = t.split("\n");
  const p = has(t, /"status"\s*:\s*"PASS"/), f = has(t, /"status"\s*:\s*"FAIL"/);
  const first = ls.find((l) => l.trim());
  if (p && f) return { ok: false, reason: "FAIL mixed PASS+FAIL" };
  const pa = has(t, /"status"\s*:\s*"PARTIAL"/);
  if (pa && (p || f)) return { ok: false, reason: "FAIL mixed PARTIAL+PASS/FAIL" };
  if (pa) {
    if (tok(first) > 50) return { ok: false, reason: "FAIL PARTIAL status line >50 tokens" };
    const m = t.match(/"cited"\s*:\s*(\d+)[\s\S]*?"total"\s*:\s*(\d+)/);
    const rr = t.match(/"remaining"\s*:\s*(\d+)/);
    if (!m) return { ok: false, reason: "FAIL PARTIAL missing coverage cited/total" };
    if (!rr) return { ok: false, reason: "FAIL PARTIAL missing remaining" };
    const cited = +m[1], total = +m[2], rem = +rr[1];
    if (rem !== total - cited) return { ok: false, reason: `FAIL PARTIAL remaining ${rem}!=total-cited ${total - cited}` };
    if (!(cited < total)) return { ok: false, reason: `FAIL PARTIAL cited ${cited} must be < total ${total}` };
    if (/COMPLETE/.test(t) && cited !== total) return { ok: false, reason: "FAIL PARTIAL COMPLETE requires cited==total" };
    if (n > 300) return { ok: false, reason: `FAIL PARTIAL >300 tokens (${n})` };
    const ti = ls.findIndex((l) => /raw/i.test(l));
    const tail = ti >= 0 ? ls.slice(ti + 1).filter((l) => l.trim()) : ls;
    if (tail.length > 20) return { ok: false, reason: `FAIL PARTIAL raw tail >20 lines (${tail.length})` };
    const ne = ls.map((l) => l.trim()).filter(Boolean);
    const last = ne[ne.length - 1] || "";
    if (/(→|->)/.test(last) || /[\w./-]+\.[A-Za-z]+:\s*$/.test(last)) {
      if (!(REQREF.test(last) && FILELINE.test(last))) return { ok: false, reason: "FAIL PARTIAL mid-pair cut" };
    }
    if (!has(t, REQREF) || !has(t, FILELINE)) return /REMAINING/i.test(t) ? { ok: true, reason: "PASS valid PARTIAL REMAINING" } : { ok: false, reason: "FAIL PARTIAL missing pairs requires REMAINING" };
    const ids = [...t.matchAll(/S-(\d+)/g)].map((x) => +x[1]);
    for (let i = 1; i < ids.length; i++) if (ids[i] <= ids[i - 1]) return { ok: false, reason: "FAIL PARTIAL priority order" };
    return { ok: true, reason: "PASS valid PARTIAL envelope" };
  }
  if (p) {
    if (tok(first) > 50) return { ok: false, reason: "FAIL PASS status line >50 tokens" };
    const m = t.match(/"cited"\s*:\s*(\d+)[\s\S]*?"total"\s*:\s*(\d+)/);
    if (!m) return { ok: false, reason: "FAIL PASS missing coverage cited/total" };
    if (m[1] !== m[2]) return { ok: false, reason: `FAIL cited ${m[1]}!=total ${m[2]}` };
    if (!has(t, REQREF) || !has(t, FILELINE)) return { ok: false, reason: "FAIL PASS missing S-N→file:line" };
    if (n > 1000) return { ok: false, reason: `FAIL PASS >1000 tokens (${n})` };
    return { ok: true, reason: "PASS valid PASS envelope" };
  }
  if (f) {
    const lim = has(t, /https?:\/\/|rootCause|NO_RESULTS/) ? 800 : 300;
    if (n > lim) return { ok: false, reason: `FAIL FAIL >${lim} tokens (${n})` };
    const i = ls.findIndex((l) => /raw/i.test(l));
    const tail = i >= 0 ? ls.slice(i + 1).filter((l) => l.trim()) : ls;
    if (tail.length > 20) return { ok: false, reason: `FAIL raw tail >20 lines (${tail.length})` };
    return { ok: true, reason: "PASS valid FAIL envelope" };
  }
  if (has(t, /NO_VERIFICATION/)) return n <= 400 ? { ok: true, reason: "PASS implementer NO_VERIFICATION" } : { ok: false, reason: `FAIL NO_VERIFICATION >400 (${n})` };
  if (has(t, /NO_RESULTS/)) return n < 800 ? { ok: true, reason: "PASS researcher NO_RESULTS" } : { ok: false, reason: "FAIL NO_RESULTS >=800" };
  if (has(t, /rootCause/) && has(t, /errorType/) && has(t, /affectedFiles/) && has(t, /fix/) && has(t, /confidence/))
    return has(t, FILELINE) ? { ok: true, reason: "PASS diagnostician JSON" } : { ok: false, reason: "FAIL diagnostician missing file:line" };
  if (has(t, /https?:\/\//) && has(t, /(^|\n)\s*[-*]/)) return n < 800 ? { ok: true, reason: "PASS researcher bullets+URLs" } : { ok: false, reason: `FAIL researcher >=800 (${n})` };
  const sm = t.match(/Status\s*:?\s*([A-Za-z_]+)/i);
  if (sm && has(t, /Pairs?/i)) {
    if (!CANON_STATUS.has(sm[1].toUpperCase())) return { ok: false, reason: `FAIL discoverer non-canonical Status ${sm[1]}` };
    if (n > 1000) return { ok: false, reason: `FAIL discoverer >1000 (${n})` };
    return has(t, FILELINE) ? { ok: true, reason: "PASS discoverer Status+Pairs" } : { ok: false, reason: "FAIL discoverer missing file:line" };
  }
  if (has(t, /S-\d+/) && has(t, /Levels?/i)) {
    if (n > 400) return { ok: false, reason: `FAIL planner >400 (${n})` };
    return has(t, FILELINE) ? { ok: true, reason: "PASS planner S-N+Levels" } : { ok: false, reason: "FAIL planner missing file:line" };
  }
  if (has(t, /S-\d+/) && has(t, FILELINE)) {
    if (n > 400) return { ok: false, reason: `FAIL tester >400 (${n})` };
    return { ok: true, reason: "PASS tester S-N coverage" };
  }
  return { ok: false, reason: "FAIL no envelope or agent shape matched" };
}
function selftest() {
  const big = Array(401).fill("w").join(" ");
  const tail21 = Array.from({ length: 21 }, (_, i) => `line${i}`).join("\n");
  const cases = [
    [`{"status":"PASS","coverage":{"cited":2,"total":2}}\nS-1 → a.ts:12\nS-2 → b.ts:34`, true],
    [`{"status":"PASS","coverage":{"cited":1,"total":2}}\nS-1 → a.ts:12`, false],
    [`{"status":"PASS","coverage":{"cited":2,"total":2}}`, false],
    [`{"status":"FAIL","unit":"task-3","raw":{"build":"err"}}\nS-1 → a.ts:5\ntail line`, true],
    [`{"status":"FAIL","x":"${"w ".repeat(350)}"}`, false],
    [`{"status":"FAIL","raw":"x"}\n${tail21}`, false],
    [`Status: PASS\nPairs:\n- a.ts:10 evidence`, true],
    [`Status: ok\nPairs:\n- a.ts:10 evidence`, false],
    [`Levels:\nS-1 → a.ts:12 do x\nS-2 → b.ts:3 do y`, true],
    [`NO_VERIFICATION reason here a.ts:1`, true],
    [`NO_VERIFICATION ${big}`, false],
    [`{"rootCause":"x","errorType":"y","affectedFiles":["a.ts:1"],"fix":"z","confidence":0.9}`, true],
    [`- finding one\n- finding two https://example.com/a`, true],
    [`NO_RESULTS nothing found`, true],
    [`{"status":"PARTIAL","coverage":{"cited":1,"total":3},"remaining":2}\nS-1 → a.ts:12\nREMAINING S-2 S-3`, true],
    [`{"status":"PARTIAL","coverage":{"cited":1,"total":3}}\nS-1 → a.ts:12`, false],
    [`{"status":"PARTIAL","coverage":{"cited":1,"total":3},"remaining":2}\nS-1 → a.ts:12\nS-2 →`, false],
    [`random prose no shape`, false],
  ];
  let bad = 0;
  cases.forEach(([inp, want], i) => {
    const r = lint(inp);
    const pass = r.ok === want;
    if (!pass) bad++;
    console.log(`${pass ? "ok" : "BAD"} ${i + 1} want=${want} got=${r.ok} :: ${r.reason}`);
  });
  return bad;
}
const args = process.argv.slice(2);
if (args.includes("--selftest")) {
  const bad = selftest();
  console.log(bad ? `FAIL selftest ${bad} mismatches` : "PASS selftest all match");
  process.exit(bad ? 1 : 0);
}
let input = "";
const fi = args.indexOf("--input-file"), ii = args.indexOf("--input");
if (fi >= 0 && args[fi + 1]) input = fs.readFileSync(args[fi + 1], "utf8");
else if (ii >= 0 && args[ii + 1]) input = args[ii + 1];
else { console.log("FAIL usage: --input '<text>' | --input-file path | --selftest"); process.exit(1); }
const r = lint(input);
console.log(r.reason);
process.exit(r.ok ? 0 : 1);
